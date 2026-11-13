-- GP-MD-02: independent planned lineups for each match period.
begin;

create table public.match_period_lineups (
  match_id uuid not null references public.matches(id) on delete cascade,
  period_number smallint not null check (period_number between 1 and 12),
  formation text not null check (formation in ('2-3-1','3-2-1')),
  updated_at timestamptz not null default now(),
  primary key (match_id, period_number)
);

create table public.match_period_lineup_entries (
  match_id uuid not null,
  period_number smallint not null,
  player_id uuid not null references public.players(id) on delete restrict,
  slot_id text not null check (slot_id in ('goalkeeper','defender-left','defender-center','defender-right','midfielder-left','midfielder-center','midfielder-right','forward')),
  position_x numeric(5,2) not null check (position_x between 0 and 100),
  position_y numeric(5,2) not null check (position_y between 0 and 100),
  primary key (match_id, period_number, player_id),
  unique (match_id, period_number, slot_id),
  foreign key (match_id, period_number) references public.match_period_lineups(match_id, period_number) on delete cascade
);

alter table public.match_period_lineups enable row level security;
alter table public.match_period_lineup_entries enable row level security;
revoke all on public.match_period_lineups, public.match_period_lineup_entries from public, anon, authenticated;
grant select on public.match_period_lineups, public.match_period_lineup_entries to authenticated;
create policy match_period_lineups_read on public.match_period_lineups for select to authenticated using
  (exists(select 1 from public.matches m where m.id=match_id and private.has_match_permission(m.group_id,'matches.view')));
create policy match_period_lineup_entries_read on public.match_period_lineup_entries for select to authenticated using
  (exists(select 1 from public.matches m where m.id=match_id and private.has_match_permission(m.group_id,'matches.view')));

insert into public.match_period_lineups(match_id,period_number,formation)
select id,1,initial_formation from public.matches on conflict do nothing;
insert into public.match_period_lineup_entries(match_id,period_number,player_id,slot_id,position_x,position_y)
select match_id,1,player_id,slot_id,position_x,position_y from public.match_initial_lineup_entries on conflict do nothing;

create function public.save_match_period_lineup(p_match_id uuid,p_period_number smallint,p_formation text,p_entries jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare target public.matches%rowtype; item jsonb; allowed text[]; players uuid[]:='{}'; slots text[]:='{}'; player uuid; slot text;
begin
  target:=private.match_live_authorize(p_match_id,true);
  if p_period_number not between 1 and target.period_count then raise exception 'Invalid period' using errcode='22023'; end if;
  if p_formation not in ('2-3-1','3-2-1') then raise exception 'Invalid formation' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_entries,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_entries,'[]'::jsonb))>7 then raise exception 'Invalid lineup entries' using errcode='22023'; end if;
  if exists(select 1 from public.match_live_states where match_id=target.id) then raise exception 'Planned lineups are immutable after the match has started' using errcode='42501'; end if;
  allowed:=case p_formation when '2-3-1' then array['goalkeeper','defender-left','defender-right','midfielder-left','midfielder-center','midfielder-right','forward'] else array['goalkeeper','defender-left','defender-center','defender-right','midfielder-left','midfielder-right','forward'] end;
  for item in select value from jsonb_array_elements(coalesce(p_entries,'[]'::jsonb)) entries(value) loop
    player:=nullif(item->>'playerId','')::uuid; slot:=nullif(item->>'slotId','');
    if player is null or slot is null or not slot=any(allowed) or player=any(players) or slot=any(slots) then raise exception 'Invalid or duplicate lineup entry' using errcode='22023'; end if;
    if not exists(select 1 from public.match_callups c where c.match_id=target.id and c.player_id=player and c.status in ('called','confirmed')) then raise exception 'Player is not available for lineup' using errcode='23503'; end if;
    players:=array_append(players,player); slots:=array_append(slots,slot);
  end loop;
  insert into public.match_period_lineups(match_id,period_number,formation,updated_at) values(target.id,p_period_number,p_formation,now())
  on conflict(match_id,period_number) do update set formation=excluded.formation,updated_at=excluded.updated_at;
  delete from public.match_period_lineup_entries where match_id=target.id and period_number=p_period_number;
  insert into public.match_period_lineup_entries(match_id,period_number,player_id,slot_id,position_x,position_y)
  select target.id,p_period_number,(value->>'playerId')::uuid,value->>'slotId',(value->>'positionX')::numeric,(value->>'positionY')::numeric from jsonb_array_elements(coalesce(p_entries,'[]'::jsonb));
  if p_period_number=1 then
    delete from public.match_initial_lineup_entries where match_id=target.id;
    insert into public.match_initial_lineup_entries(match_id,player_id,slot_id,position_x,position_y)
    select match_id,player_id,slot_id,position_x,position_y from public.match_period_lineup_entries where match_id=target.id and period_number=1;
    update public.matches set initial_formation=p_formation,updated_at=now(),lineup_revision=lineup_revision+1 where id=target.id;
  end if;
end $$;

create function public.apply_match_period_lineup(p_match_id uuid,p_period_number smallint)
returns void language plpgsql security definer set search_path='' as $$
declare target public.matches%rowtype; state public.match_live_states%rowtype; count_entries integer;
begin
  target:=private.match_live_authorize(p_match_id,true);
  select * into state from public.match_live_states where match_id=target.id for update;
  if not found or state.phase<>'interval' or p_period_number<>state.current_period+1 or p_period_number>target.period_count then raise exception 'Planned lineup can only be applied to the next period during the interval' using errcode='22023'; end if;
  select count(*) into count_entries from public.match_period_lineup_entries e join public.match_callups c on c.match_id=e.match_id and c.player_id=e.player_id and c.status in ('called','confirmed') where e.match_id=target.id and e.period_number=p_period_number;
  if count_entries<>7 then raise exception 'Planned lineup requires exactly seven players' using errcode='22023'; end if;
  delete from public.match_live_active_players where match_id=target.id;
  insert into public.match_live_active_players(match_id,player_id,slot_id)
  select match_id,player_id,slot_id from public.match_period_lineup_entries where match_id=target.id and period_number=p_period_number;
  update public.match_live_states set version=version+1,updated_at=now() where match_id=target.id;
end $$;

alter function public.save_match_period_lineup(uuid,smallint,text,jsonb) owner to postgres;
alter function public.apply_match_period_lineup(uuid,smallint) owner to postgres;
revoke all on function public.save_match_period_lineup(uuid,smallint,text,jsonb),public.apply_match_period_lineup(uuid,smallint) from public,anon;
grant execute on function public.save_match_period_lineup(uuid,smallint,text,jsonb),public.apply_match_period_lineup(uuid,smallint) to authenticated;
commit;
