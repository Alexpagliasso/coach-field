begin;

-- Keep player lifecycle and roster activation synchronized on the same player row.
-- These guards also cover direct writes that are allowed by existing RLS policies.
create function private.guard_active_player_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_organization uuid;
  player_archived_at timestamptz;
begin
  if new.status = 'active' then
    select p.organization_id, p.archived_at
      into player_organization, player_archived_at
    from public.players p
    where p.id = new.player_id
    for update;

    if not found or player_organization is distinct from new.organization_id then
      raise exception 'Player does not belong to the membership organization'
        using errcode = '23503';
    end if;
    if player_archived_at is not null then
      raise exception 'Archived player cannot have an active membership'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

alter function private.guard_active_player_membership() owner to postgres;
revoke all on function private.guard_active_player_membership() from public, anon, authenticated;

create trigger guard_active_team_player_membership
before insert or update of player_id, organization_id, status
on public.team_player_memberships
for each row execute function private.guard_active_player_membership();

create trigger guard_active_legacy_group_player_membership
before insert or update of player_id, organization_id, status
on public.group_player_memberships
for each row execute function private.guard_active_player_membership();

create function public.remove_team_roster_player(
  p_team_player_membership_id uuid
)
returns table(membership_id uuid, ended_assignment_count integer, operation text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_membership public.team_player_memberships%rowtype;
  affected_assignments integer := 0;
  membership_changed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_team_player_membership_id is null then
    raise exception 'Team player membership is required' using errcode = '22023';
  end if;

  select membership.* into target_membership
  from public.team_player_memberships membership
  where membership.id = p_team_player_membership_id
  for update;

  if not found then
    raise exception 'Team player membership not found' using errcode = 'P0002';
  end if;
  if not private.is_admin(target_membership.organization_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  perform assignment.id
  from public.group_player_assignments assignment
  where assignment.team_player_membership_id = target_membership.id
  for update;

  update public.group_player_assignments assignment
  set status = 'ended',
      ended_at = greatest(current_date, assignment.assigned_at)
  where assignment.team_player_membership_id = target_membership.id
    and assignment.status = 'active';
  get diagnostics affected_assignments = row_count;

  if target_membership.status = 'active' then
    update public.team_player_memberships
    set status = 'left',
        left_at = greatest(current_date, target_membership.joined_at)
    where id = target_membership.id;
    membership_changed := true;
  end if;

  membership_id := target_membership.id;
  ended_assignment_count := affected_assignments;
  operation := case
    when membership_changed or affected_assignments > 0 then 'removed'
    else 'unchanged'
  end;
  return next;
end;
$$;

create function public.archive_organization_player(
  p_player_id uuid,
  p_organization_id uuid
)
returns table(player_id uuid, operation text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_player public.players%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_player_id is null or p_organization_id is null then
    raise exception 'Player and organization are required' using errcode = '22023';
  end if;

  -- Same row lock acquired by the membership activation triggers.
  select player.* into target_player
  from public.players player
  where player.id = p_player_id
    and player.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Player not found in organization' using errcode = 'P0002';
  end if;
  if not private.is_admin(target_player.organization_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.team_player_memberships membership
    where membership.player_id = target_player.id
      and membership.organization_id = target_player.organization_id
      and membership.status = 'active'
  ) then
    raise exception 'Player still belongs to an active team roster' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.group_player_memberships membership
    where membership.player_id = target_player.id
      and membership.organization_id = target_player.organization_id
      and membership.status = 'active'
  ) then
    raise exception 'Player still has an active legacy group membership' using errcode = '23514';
  end if;

  player_id := target_player.id;
  if target_player.archived_at is not null then
    operation := 'unchanged';
  else
    update public.players set archived_at = now() where id = target_player.id;
    operation := 'archived';
  end if;
  return next;
end;
$$;

create function public.delete_organization_player(
  p_player_id uuid,
  p_organization_id uuid
)
returns table(player_id uuid, deleted_membership_count integer, deleted_assignment_count integer, operation text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_player public.players%rowtype;
  affected_memberships integer := 0;
  affected_assignments integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_player_id is null or p_organization_id is null then
    raise exception 'Player and organization are required' using errcode = '22023';
  end if;

  select player.* into target_player
  from public.players player
  where player.id = p_player_id
    and player.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Player not found in organization' using errcode = 'P0002';
  end if;
  if not private.is_admin(target_player.organization_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if target_player.archived_at is null then
    raise exception 'Player must be archived before permanent deletion' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.team_player_memberships membership
    where membership.player_id = target_player.id
      and membership.organization_id = target_player.organization_id
      and membership.status = 'active'
  ) then
    raise exception 'Player still belongs to an active team roster' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.group_player_memberships membership
    where membership.player_id = target_player.id
      and membership.organization_id = target_player.organization_id
  ) then
    raise exception 'Player has legacy group history that must be preserved' using errcode = '23514';
  end if;

  -- Historical team assignments are intentionally deleted only in this
  -- explicit permanent-delete operation. Unknown RESTRICT FKs abort it.
  perform membership.id
  from public.team_player_memberships membership
  where membership.player_id = target_player.id
    and membership.organization_id = target_player.organization_id
  for update;

  perform assignment.id
  from public.group_player_assignments assignment
  join public.team_player_memberships membership
    on membership.id = assignment.team_player_membership_id
   and membership.organization_id = assignment.organization_id
   and membership.team_id = assignment.team_id
  where membership.player_id = target_player.id
    and membership.organization_id = target_player.organization_id
  for update of assignment;

  delete from public.group_player_assignments assignment
  using public.team_player_memberships membership
  where assignment.team_player_membership_id = membership.id
    and assignment.organization_id = membership.organization_id
    and assignment.team_id = membership.team_id
    and membership.player_id = target_player.id
    and membership.organization_id = target_player.organization_id;
  get diagnostics affected_assignments = row_count;

  delete from public.team_player_memberships membership
  where membership.player_id = target_player.id
    and membership.organization_id = target_player.organization_id;
  get diagnostics affected_memberships = row_count;

  delete from public.players player
  where player.id = target_player.id
    and player.organization_id = target_player.organization_id;

  player_id := target_player.id;
  deleted_membership_count := affected_memberships;
  deleted_assignment_count := affected_assignments;
  operation := 'deleted';
  return next;
end;
$$;

alter function public.remove_team_roster_player(uuid) owner to postgres;
alter function public.archive_organization_player(uuid,uuid) owner to postgres;
alter function public.delete_organization_player(uuid,uuid) owner to postgres;

revoke all on function public.remove_team_roster_player(uuid) from public, anon;
revoke all on function public.archive_organization_player(uuid,uuid) from public, anon;
revoke all on function public.delete_organization_player(uuid,uuid) from public, anon;
grant execute on function public.remove_team_roster_player(uuid) to authenticated;
grant execute on function public.archive_organization_player(uuid,uuid) to authenticated;
grant execute on function public.delete_organization_player(uuid,uuid) to authenticated;

commit;
