-- Coach Field — cloud attendance for training sessions
begin;

create table public.training_session_guest_players (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid not null references public.training_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  added_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (training_session_id, player_id)
);

create table public.training_session_attendance (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid not null references public.training_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  status text not null check (status in ('present', 'absent', 'excused')),
  note text not null default '' check (char_length(note) <= 2000),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (training_session_id, player_id)
);
create index training_session_attendance_session_idx on public.training_session_attendance(training_session_id);
create index training_session_attendance_player_idx on public.training_session_attendance(player_id, created_at desc);

create or replace function private.validate_training_attendance_reference()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  session_org uuid;
  player_org uuid;
begin
  select organization_id into session_org from public.training_sessions where id = new.training_session_id;
  select organization_id into player_org from public.players where id = new.player_id;
  if session_org is null or player_org is null or new.organization_id <> session_org or player_org <> session_org then
    raise exception 'Attendance player and session must belong to the same organization' using errcode = '23503';
  end if;
  return new;
end;
$$;
alter function private.validate_training_attendance_reference() owner to postgres;
revoke all on function private.validate_training_attendance_reference() from public, anon, authenticated;
create trigger validate_training_session_guest_player before insert or update of training_session_id, organization_id, player_id on public.training_session_guest_players for each row execute function private.validate_training_attendance_reference();
create trigger validate_training_session_attendance before insert or update of training_session_id, organization_id, player_id on public.training_session_attendance for each row execute function private.validate_training_attendance_reference();

-- A mark is valid only for the session's current stable roster or for a guest
-- explicitly aggregated for that session.  Historical marks remain valid when a
-- player later changes WorkGroup because this trigger is not fired on assignment
-- changes.
create or replace function private.validate_training_attendance_participant()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_group uuid;
begin
  select group_id into target_group from public.training_sessions where id = new.training_session_id;
  if not exists (
    select 1
    from public.group_player_assignments assignment
    join public.team_player_memberships membership on membership.id = assignment.team_player_membership_id
    where assignment.group_id = target_group
      and assignment.status = 'active'
      and membership.status = 'active'
      and membership.player_id = new.player_id
  ) and not exists (
    select 1 from public.training_session_guest_players guest
    where guest.training_session_id = new.training_session_id and guest.player_id = new.player_id
  ) then
    raise exception 'Player is not part of this training session roll call' using errcode = '23503';
  end if;
  return new;
end;
$$;
alter function private.validate_training_attendance_participant() owner to postgres;
revoke all on function private.validate_training_attendance_participant() from public, anon, authenticated;
create trigger validate_training_session_attendance_participant before insert or update of training_session_id, player_id on public.training_session_attendance for each row execute function private.validate_training_attendance_participant();

-- Keep history intentional: a guest with a recorded mark cannot be removed.
-- Clear its attendance first to return the person to the unmarked state.
create or replace function private.prevent_attendance_guest_history_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.training_session_attendance attendance where attendance.training_session_id = old.training_session_id and attendance.player_id = old.player_id) then
    raise exception 'Clear attendance before removing an aggregated player' using errcode = '23503';
  end if;
  return old;
end;
$$;
alter function private.prevent_attendance_guest_history_delete() owner to postgres;
revoke all on function private.prevent_attendance_guest_history_delete() from public, anon, authenticated;
create trigger prevent_training_guest_history_delete before delete on public.training_session_guest_players for each row execute function private.prevent_attendance_guest_history_delete();

alter table public.training_session_guest_players enable row level security;
alter table public.training_session_attendance enable row level security;
grant select, insert, update, delete on public.training_session_guest_players, public.training_session_attendance to authenticated;
create policy training_guest_read on public.training_session_guest_players for select to authenticated using (exists (select 1 from public.training_sessions s where s.id=training_session_id and private.has_training_permission(s.group_id,'training.view')));
create policy training_guest_write on public.training_session_guest_players for all to authenticated using (exists (select 1 from public.training_sessions s where s.id=training_session_id and private.has_training_permission(s.group_id,'training.edit'))) with check (exists (select 1 from public.training_sessions s where s.id=training_session_id and private.has_training_permission(s.group_id,'training.edit')));
create policy training_attendance_read on public.training_session_attendance for select to authenticated using (exists (select 1 from public.training_sessions s where s.id=training_session_id and private.has_training_permission(s.group_id,'training.view')));
create policy training_attendance_write on public.training_session_attendance for all to authenticated using (exists (select 1 from public.training_sessions s where s.id=training_session_id and private.has_training_permission(s.group_id,'training.edit'))) with check (exists (select 1 from public.training_sessions s where s.id=training_session_id and private.has_training_permission(s.group_id,'training.edit')));

create or replace function public.mark_training_session_all_present(p_training_session_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare target public.training_sessions%rowtype; changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into target from public.training_sessions where id=p_training_session_id for update;
  if not found or not private.has_training_permission(target.group_id,'training.edit') then raise exception 'Permission denied or session not found' using errcode='42501'; end if;
  insert into public.training_session_attendance(training_session_id,organization_id,player_id,status,created_by)
  select target.id,target.organization_id,entry.player_id,'present',auth.uid()
  from (
    select membership.player_id from public.group_player_assignments assignment join public.team_player_memberships membership on membership.id=assignment.team_player_membership_id where assignment.group_id=target.group_id and assignment.status='active' and membership.status='active'
    union
    select player_id from public.training_session_guest_players where training_session_id=target.id
  ) entry
  on conflict (training_session_id,player_id) do update set status='present', updated_at=now();
  get diagnostics changed=row_count;
  return changed;
end;
$$;
alter function public.mark_training_session_all_present(uuid) owner to postgres;
revoke all on function public.mark_training_session_all_present(uuid) from public, anon, authenticated;
grant execute on function public.mark_training_session_all_present(uuid) to authenticated;
commit;
