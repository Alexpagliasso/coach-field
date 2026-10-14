begin;

create function public.set_team_roster_player_group(
  p_team_player_membership_id uuid,
  p_group_id uuid default null
)
returns table(assignment_id uuid, previous_assignment_id uuid, operation text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_membership public.team_player_memberships;
  target_group public.groups;
  current_assignment public.group_player_assignments;
  created_assignment_id uuid;
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

  if p_group_id is not null then
    if target_membership.status <> 'active' then
      raise exception 'Only an active team membership can be assigned' using errcode = '23514';
    end if;

    select work_group.* into target_group
    from public.groups work_group
    where work_group.id = p_group_id;

    if not found
      or target_group.organization_id <> target_membership.organization_id
      or target_group.team_id is distinct from target_membership.team_id then
      raise exception 'WorkGroup does not belong to the membership team and organization' using errcode = '23503';
    end if;
    if not target_group.active then
      raise exception 'WorkGroup is inactive' using errcode = '23514';
    end if;
  end if;

  select assignment.* into current_assignment
  from public.group_player_assignments assignment
  where assignment.team_player_membership_id = target_membership.id
    and assignment.status = 'active'
  for update;

  if found and p_group_id is not null and current_assignment.group_id = p_group_id then
    assignment_id := current_assignment.id;
    previous_assignment_id := null;
    operation := 'unchanged';
    return next;
    return;
  end if;

  if current_assignment.id is not null then
    update public.group_player_assignments
    set status = 'ended', ended_at = greatest(current_date, current_assignment.assigned_at)
    where id = current_assignment.id;
    previous_assignment_id := current_assignment.id;
  end if;

  if p_group_id is null then
    assignment_id := null;
    operation := case when previous_assignment_id is null then 'unchanged' else 'removed' end;
    return next;
    return;
  end if;

  insert into public.group_player_assignments(
    organization_id, team_id, group_id, team_player_membership_id
  ) values (
    target_membership.organization_id, target_membership.team_id, p_group_id, target_membership.id
  )
  returning id into created_assignment_id;

  assignment_id := created_assignment_id;
  operation := case when previous_assignment_id is null then 'assigned' else 'changed' end;
  return next;
end;
$$;

alter function public.set_team_roster_player_group(uuid,uuid) owner to postgres;
revoke all on function public.set_team_roster_player_group(uuid,uuid) from public, anon;
grant execute on function public.set_team_roster_player_group(uuid,uuid) to authenticated;

commit;
