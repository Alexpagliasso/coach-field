-- GrowPitch
-- 202610170022_match_configuration_and_lineups.sql
-- Apply manually after migrations 015 and 016.

begin;

-- =========================================================
-- 1. MATCH CONFIGURATION
-- =========================================================

alter table public.matches
  add column if not exists match_format text not null default 'seven_a_side',
  add column if not exists period_count smallint not null default 4,
  add column if not exists period_duration_minutes smallint not null default 15,
  add column if not exists initial_formation text not null default '2-3-1',
  add column if not exists lineup_revision bigint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_format_check'
  ) then
    alter table public.matches
      add constraint matches_format_check
      check (match_format = 'seven_a_side');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_period_count_check'
  ) then
    alter table public.matches
      add constraint matches_period_count_check
      check (period_count between 1 and 12);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_period_duration_check'
  ) then
    alter table public.matches
      add constraint matches_period_duration_check
      check (period_duration_minutes between 1 and 60);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.matches'::regclass
      and conname = 'matches_initial_formation_check'
  ) then
    alter table public.matches
      add constraint matches_initial_formation_check
      check (initial_formation in ('2-3-1', '3-2-1'));
  end if;
end;
$$;

-- =========================================================
-- 2. INITIAL LINEUP
-- =========================================================

create table if not exists public.match_initial_lineup_entries (
  id uuid primary key default gen_random_uuid(),

  match_id uuid not null
    references public.matches(id) on delete cascade,

  player_id uuid not null
    references public.players(id) on delete restrict,

  slot_id text not null check (
    slot_id in (
      'goalkeeper',
      'defender-left',
      'defender-center',
      'defender-right',
      'midfielder-left',
      'midfielder-center',
      'midfielder-right',
      'forward'
    )
  ),

  position_x numeric(5,2) not null
    check (position_x between 0 and 100),

  position_y numeric(5,2) not null
    check (position_y between 0 and 100),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (match_id, player_id),
  unique (match_id, slot_id)
);

create index if not exists match_initial_lineup_entries_match_idx
  on public.match_initial_lineup_entries(match_id);

-- =========================================================
-- 3. UPDATED_AT
-- =========================================================

create or replace function private.touch_match_initial_lineup_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

alter function private.touch_match_initial_lineup_updated_at()
  owner to postgres;

revoke all on function private.touch_match_initial_lineup_updated_at()
  from public, anon, authenticated;

drop trigger if exists touch_match_initial_lineup_entries_updated_at
  on public.match_initial_lineup_entries;

create trigger touch_match_initial_lineup_entries_updated_at
before update on public.match_initial_lineup_entries
for each row
execute function private.touch_match_initial_lineup_updated_at();

-- =========================================================
-- 4. RLS
-- =========================================================

alter table public.match_initial_lineup_entries
  enable row level security;

revoke all on public.match_initial_lineup_entries
  from anon, authenticated;

grant select on public.match_initial_lineup_entries
  to authenticated;

drop policy if exists match_initial_lineup_read
  on public.match_initial_lineup_entries;

create policy match_initial_lineup_read
on public.match_initial_lineup_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where m.id = match_id
      and private.has_match_permission(
        m.group_id,
        'matches.view'
      )
  )
);

-- =========================================================
-- 5. ATOMIC SAVE RPC
-- =========================================================

create or replace function public.save_match_initial_lineup(
  p_match_id uuid,
  p_entries jsonb,
  p_expected_updated_at timestamptz default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.matches%rowtype;
  item jsonb;

  v_player uuid;
  v_slot text;
  v_x numeric;
  v_y numeric;

  seen_players uuid[] := '{}';
  seen_slots text[] := '{}';

  allowed_slots text[];
  next_updated_at timestamptz;
begin

  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if p_expected_updated_at is null then
    raise exception 'Expected match version is required'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array' then
    raise exception 'Lineup entries must be a JSON array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(coalesce(p_entries, '[]'::jsonb)) > 7 then
    raise exception 'Maximum seven players allowed'
      using errcode = '22023';
  end if;

  select *
  into target
  from public.matches
  where id = p_match_id
  for update;

  if not found
     or not private.has_match_permission(
       target.group_id,
       'matches.edit'
     ) then
    raise exception 'Permission denied or match not found'
      using errcode = '42501';
  end if;

  if target.updated_at is distinct from p_expected_updated_at then
    raise exception 'Match changed. Reload before saving.'
      using errcode = '40001';
  end if;

  allowed_slots :=
    case target.initial_formation
      when '2-3-1' then
        array[
          'goalkeeper',
          'defender-left',
          'defender-right',
          'midfielder-left',
          'midfielder-center',
          'midfielder-right',
          'forward'
        ]
      when '3-2-1' then
        array[
          'goalkeeper',
          'defender-left',
          'defender-center',
          'defender-right',
          'midfielder-left',
          'midfielder-right',
          'forward'
        ]
      else array[]::text[]
    end;

  for item in
    select value
    from jsonb_array_elements(
      coalesce(p_entries, '[]'::jsonb)
    ) as entries(value)
  loop

    if jsonb_typeof(item) <> 'object' then
      raise exception 'Invalid lineup entry'
        using errcode = '22023';
    end if;

    v_player := nullif(item->>'playerId', '')::uuid;
    v_slot := nullif(item->>'slotId', '');
    v_x := nullif(item->>'positionX', '')::numeric;
    v_y := nullif(item->>'positionY', '')::numeric;

    if v_player is null
       or v_slot is null
       or v_x is null
       or v_y is null
       or v_x not between 0 and 100
       or v_y not between 0 and 100 then
      raise exception 'Invalid player, slot or coordinates'
        using errcode = '22023';
    end if;

    if not v_slot = any(allowed_slots) then
      raise exception 'Slot incompatible with formation'
        using errcode = '22023';
    end if;

    if v_player = any(seen_players)
       or v_slot = any(seen_slots) then
      raise exception 'Duplicate player or slot'
        using errcode = '23505';
    end if;

    if not exists (
      select 1
      from public.match_callups c
      where c.match_id = target.id
        and c.player_id = v_player
        and c.status in ('called', 'confirmed')
    ) then
      raise exception 'Player is not available for lineup'
        using errcode = '23503';
    end if;

    seen_players := array_append(seen_players, v_player);
    seen_slots := array_append(seen_slots, v_slot);

  end loop;

  delete from public.match_initial_lineup_entries
  where match_id = target.id;

  insert into public.match_initial_lineup_entries (
    match_id,
    player_id,
    slot_id,
    position_x,
    position_y
  )
  select
    target.id,
    (value->>'playerId')::uuid,
    value->>'slotId',
    (value->>'positionX')::numeric,
    (value->>'positionY')::numeric
  from jsonb_array_elements(
    coalesce(p_entries, '[]'::jsonb)
  );

  update public.matches
  set
    updated_at = clock_timestamp(),
    lineup_revision = lineup_revision + 1
  where id = target.id
  returning updated_at into next_updated_at;

  return next_updated_at;

end;
$$;

alter function public.save_match_initial_lineup(
  uuid, jsonb, timestamptz
) owner to postgres;

revoke all on function public.save_match_initial_lineup(
  uuid, jsonb, timestamptz
) from public, anon, authenticated;

grant execute on function public.save_match_initial_lineup(
  uuid, jsonb, timestamptz
) to authenticated;

commit;