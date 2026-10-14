-- Coach Field — cloud training library (replacement for unapplied migration 013)
-- IMPORTANT: apply only if migration 013 has NOT previously been run remotely.
begin;

create table public.exercise_library_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  objective text not null default '' check (char_length(btrim(objective)) <= 500),
  short_description text not null default '' check (char_length(short_description) <= 2000),
  detailed_description text check (detailed_description is null or char_length(detailed_description) <= 10000),
  suggested_duration_minutes integer check (suggested_duration_minutes is null or suggested_duration_minutes between 1 and 480),
  suggested_player_count integer check (suggested_player_count is null or suggested_player_count between 1 and 100),
  materials text[] not null default '{}',
  tags text[] not null default '{}',
  category text,
  source_collection text,
  source_id text,
  normalized_identity text generated always as (
    lower(regexp_replace(btrim(name) || ' ' || btrim(objective), '[[:space:]]+', ' ', 'g'))
  ) stored,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_source_pair_check check (
    (source_collection is null and source_id is null) or
    (source_collection is not null and source_id is not null and
     char_length(btrim(source_collection)) between 1 and 160 and
     char_length(btrim(source_id)) between 1 and 160)
  ),
  unique (organization_id, source_collection, source_id),
  unique (id, organization_id)
);

create index exercise_library_org_search_idx on public.exercise_library_items(organization_id, name);
create index exercise_library_org_category_idx on public.exercise_library_items(organization_id, category);
create index exercise_library_identity_idx on public.exercise_library_items(organization_id, normalized_identity);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  group_id uuid not null,
  session_date date not null,
  start_time time,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  objective text not null default '',
  planned_duration_minutes integer not null check (planned_duration_minutes between 1 and 480),
  coach_notes text not null default '',
  status text not null default 'planned' check (status in ('planned', 'completed')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (group_id, organization_id) references public.groups(id, organization_id) on delete restrict,
  unique (id, organization_id)
);

create index training_sessions_group_date_idx on public.training_sessions(group_id, session_date);

create table public.training_session_exercises (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid not null references public.training_sessions(id) on delete cascade,
  exercise_id uuid references public.exercise_library_items(id) on delete set null,
  position integer not null check (position > 0),
  snapshot_name text not null check (char_length(btrim(snapshot_name)) between 1 and 160),
  snapshot_objective text not null default '',
  snapshot_description text not null default '',
  duration_minutes integer not null check (duration_minutes between 1 and 480),
  coach_notes text not null default '',
  unique (training_session_id, position)
);

create index training_session_exercises_session_idx on public.training_session_exercises(training_session_id, position);

-- Use existing organization/group permission conventions; do not grant admin-equivalent
-- access to a collaborator unless explicitly configured.
create or replace function private.has_training_permission(grp uuid, requested text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.groups g
    where g.id = grp and (
      private.is_admin(g.organization_id)
      or (g.active and exists (
        select 1 from public.group_memberships m
        where m.group_id = g.id and m.user_id = auth.uid() and m.active
          and (m.role = 'coach' or (
            m.role = 'collaborator' and coalesce((
              select p.enabled from public.collaborator_permissions p
              where p.membership_id = m.id and p.permission = requested
            ), requested in ('training.view', 'templates.view'))
          ))
      ))
    )
  );
$$;
alter function private.has_training_permission(uuid, text) owner to postgres;
revoke all on function private.has_training_permission(uuid, text) from public, anon, authenticated;
grant execute on function private.has_training_permission(uuid, text) to authenticated;
-- Required for policies evaluated under the authenticated role.

-- Reject direct cross-organization references even when a caller has write permission
-- to a session but the selected exercise belongs to another organization.
create or replace function private.validate_training_session_exercise()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  session_org uuid;
  exercise_org uuid;
begin
  if new.exercise_id is null then
    return new;
  end if;
  select organization_id into session_org
    from public.training_sessions where id = new.training_session_id;
  select organization_id into exercise_org
    from public.exercise_library_items where id = new.exercise_id;
  if session_org is null or exercise_org is null or session_org <> exercise_org then
    raise exception 'Exercise and training session must belong to the same organization'
      using errcode = '23503';
  end if;
  return new;
end;
$$;
alter function private.validate_training_session_exercise() owner to postgres;
revoke all on function private.validate_training_session_exercise() from public, anon, authenticated;
create trigger validate_training_session_exercise_trigger
  before insert or update of training_session_id, exercise_id
  on public.training_session_exercises
  for each row execute function private.validate_training_session_exercise();

alter table public.exercise_library_items enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_session_exercises enable row level security;
grant select, insert, update, delete on public.exercise_library_items,
  public.training_sessions, public.training_session_exercises to authenticated;

create policy exercise_read on public.exercise_library_items for select to authenticated
using (exists (
  select 1 from public.groups g
  where g.organization_id = exercise_library_items.organization_id
    and private.has_training_permission(g.id, 'templates.view')
));
create policy exercise_write on public.exercise_library_items for all to authenticated
using (exists (
  select 1 from public.groups g
  where g.organization_id = exercise_library_items.organization_id
    and private.has_training_permission(g.id, 'templates.edit')
))
with check (exists (
  select 1 from public.groups g
  where g.organization_id = exercise_library_items.organization_id
    and private.has_training_permission(g.id, 'templates.edit')
));

create policy session_read on public.training_sessions for select to authenticated
using (private.has_training_permission(group_id, 'training.view'));
create policy session_write on public.training_sessions for all to authenticated
using (private.has_training_permission(group_id, 'training.edit'))
with check (private.has_training_permission(group_id, 'training.edit'));

create policy session_exercise_read on public.training_session_exercises for select to authenticated
using (exists (
  select 1 from public.training_sessions s
  where s.id = training_session_id
    and private.has_training_permission(s.group_id, 'training.view')
));
create policy session_exercise_write on public.training_session_exercises for all to authenticated
using (exists (
  select 1 from public.training_sessions s
  where s.id = training_session_id
    and private.has_training_permission(s.group_id, 'training.edit')
))
with check (exists (
  select 1 from public.training_sessions s
  where s.id = training_session_id
    and private.has_training_permission(s.group_id, 'training.edit')
));

-- All writes in this function are in the caller's transaction. Invalid input rolls back
-- the session header and all exercise changes together.
create or replace function public.save_training_session(
  p_session_id uuid, p_group_id uuid, p_date date, p_start_time time,
  p_title text, p_objective text, p_duration integer, p_notes text,
  p_status text, p_exercises jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  sid uuid := coalesce(p_session_id, gen_random_uuid());
  org uuid;
  current_session public.training_sessions%rowtype;
  item jsonb;
  pos integer := 0;
  ex public.exercise_library_items%rowtype;
  item_duration integer;
  item_name text;
  item_objective text;
  item_description text;
  item_exercise_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select organization_id into org from public.groups
    where id = p_group_id and active is true;
  if org is null or not private.has_training_permission(p_group_id, 'training.edit') then
    raise exception 'Permission denied or invalid WorkGroup' using errcode = '42501';
  end if;
  if p_date is null or char_length(btrim(coalesce(p_title, ''))) not between 1 and 200
     or p_duration is null or p_duration not between 1 and 480
     or p_status is null or p_status not in ('planned', 'completed') then
    raise exception 'Invalid training session' using errcode = '22023';
  end if;
  if p_exercises is not null and jsonb_typeof(p_exercises) <> 'array' then
    raise exception 'Exercises must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_exercises, '[]'::jsonb)) > 100 then
    raise exception 'Too many exercises in session' using errcode = '22023';
  end if;

  -- Lock existing session, check ownership/group BEFORE changing anything.
  if p_session_id is not null then
    select * into current_session from public.training_sessions
      where id = sid for update;
    if found then
      if current_session.group_id <> p_group_id or current_session.organization_id <> org then
        raise exception 'Cannot move or modify a session from another WorkGroup'
          using errcode = '42501';
      end if;
      update public.training_sessions
      set session_date = p_date, start_time = p_start_time,
          title = btrim(p_title), objective = coalesce(p_objective, ''),
          planned_duration_minutes = p_duration, coach_notes = coalesce(p_notes, ''),
          status = p_status, updated_at = now()
      where id = sid;
    else
      -- A supplied UUID must not silently create a new record.
      raise exception 'Session not found' using errcode = 'P0002';
    end if;
  else
    insert into public.training_sessions (
      id, organization_id, group_id, session_date, start_time, title,
      objective, planned_duration_minutes, coach_notes, status, created_by
    ) values (
      sid, org, p_group_id, p_date, p_start_time, btrim(p_title),
      coalesce(p_objective, ''), p_duration, coalesce(p_notes, ''),
      p_status, auth.uid()
    );
  end if;

  -- Snapshot values are captured from the library when first added.
  -- Existing session snapshots can be preserved by passing their stored values
  -- back on edit; the repository must do this to avoid rewriting history.
  delete from public.training_session_exercises where training_session_id = sid;
  for item in select value from jsonb_array_elements(coalesce(p_exercises, '[]'::jsonb)) as t(value) loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Exercise entries must be objects' using errcode = '22023';
    end if;
    pos := pos + 1;
    item_duration := (item->>'durationMinutes')::integer;
    if item_duration is null or item_duration not between 1 and 480 then
      raise exception 'Exercise duration is invalid' using errcode = '22023';
    end if;
    item_exercise_id := nullif(item->>'exerciseId', '')::uuid;
    if item_exercise_id is not null then
      select * into ex from public.exercise_library_items
        where id = item_exercise_id and organization_id = org;
      if not found then
        raise exception 'Exercise does not belong to organization' using errcode = '23503';
      end if;
      item_name := coalesce(nullif(btrim(item->>'snapshotName'), ''), ex.name);
      item_objective := coalesce(item->>'snapshotObjective', ex.objective);
      item_description := coalesce(item->>'snapshotDescription',
        coalesce(ex.detailed_description, ex.short_description));
    else
      item_name := nullif(btrim(coalesce(item->>'snapshotName', '')), '');
      item_objective := coalesce(item->>'snapshotObjective', '');
      item_description := coalesce(item->>'snapshotDescription', '');
      if item_name is null then
        raise exception 'Custom exercise name is required' using errcode = '22023';
      end if;
    end if;
    insert into public.training_session_exercises (
      training_session_id, exercise_id, position, snapshot_name,
      snapshot_objective, snapshot_description, duration_minutes, coach_notes
    ) values (
      sid, item_exercise_id, pos, item_name, item_objective,
      item_description, item_duration, coalesce(item->>'coachNotes', '')
    );
  end loop;
  return sid;
end;
$$;

create or replace function public.duplicate_training_session(p_session_id uuid, p_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.training_sessions%rowtype;
  nid uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select * into s from public.training_sessions where id = p_session_id for share;
  if not found or not private.has_training_permission(s.group_id, 'training.edit') then
    raise exception 'Permission denied or session not found' using errcode = '42501';
  end if;
  insert into public.training_sessions (
    id, organization_id, group_id, session_date, start_time, title,
    objective, planned_duration_minutes, coach_notes, status, created_by
  ) values (
    nid, s.organization_id, s.group_id, coalesce(p_date, s.session_date),
    s.start_time, left(s.title, 194) || ' copia', s.objective,
    s.planned_duration_minutes, s.coach_notes, 'planned', auth.uid()
  );
  insert into public.training_session_exercises (
    training_session_id, exercise_id, position, snapshot_name,
    snapshot_objective, snapshot_description, duration_minutes, coach_notes
  )
  select nid, exercise_id, position, snapshot_name,
         snapshot_objective, snapshot_description, duration_minutes, coach_notes
  from public.training_session_exercises where training_session_id = s.id;
  return nid;
end;
$$;

alter function public.save_training_session(uuid,uuid,date,time,text,text,integer,text,text,jsonb) owner to postgres;
alter function public.duplicate_training_session(uuid,date) owner to postgres;
revoke all on function public.save_training_session(uuid,uuid,date,time,text,text,integer,text,text,jsonb),
  public.duplicate_training_session(uuid,date) from public, anon, authenticated;
grant execute on function public.save_training_session(uuid,uuid,date,time,text,text,integer,text,text,jsonb),
  public.duplicate_training_session(uuid,date) to authenticated;

commit;
