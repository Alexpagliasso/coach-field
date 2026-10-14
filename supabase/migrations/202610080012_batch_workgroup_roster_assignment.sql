
begin;

create or replace function public.assign_team_roster_players_to_workgroup(
  p_group_id uuid,
  p_team_player_membership_ids uuid[]
)
returns table(
  assigned_count integer,
  moved_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group public.groups%rowtype;
  membership_ids uuid[];
  matched_count integer;
  inserted_count integer := 0;
  transferred_count integer := 0;
begin
  -- 1. Authentication
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  -- 2. Input validation
  if p_group_id is null
     or p_team_player_membership_ids is null
     or cardinality(p_team_player_membership_ids) = 0 then
    raise exception
      'WorkGroup and at least one roster membership are required'
      using errcode = '22023';
  end if;

  -- Normalize input and remove duplicates.
  select array_agg(
    distinct input.membership_id
    order by input.membership_id
  )
  into membership_ids
  from unnest(p_team_player_membership_ids)
    as input(membership_id);

  -- Reject NULL elements instead of silently ignoring them.
  if array_position(p_team_player_membership_ids, null) is not null
     or membership_ids is null
     or cardinality(membership_ids) = 0 then
    raise exception 'Invalid roster membership identifiers'
      using errcode = '22023';
  end if;

  -- 3. Resolve target WorkGroup
  select *
  into target_group
  from public.groups
  where id = p_group_id
    and active is true;

  if not found then
    raise exception 'WorkGroup not found or inactive'
      using errcode = 'P0002';
  end if;

  -- 4. Authorization: organization admins only.
  if not private.is_admin(target_group.organization_id) then
    raise exception 'Permission denied'
      using errcode = '42501';
  end if;

  -- 5. Serialize concurrent operations on the same memberships.
  -- Every other assignment writer must follow this lock protocol.
  perform membership.id
  from public.team_player_memberships membership
  where membership.id = any(membership_ids)
  order by membership.id
  for update;

  -- 6. Validate every requested membership.
  select count(*)
  into matched_count
  from public.team_player_memberships membership
  where membership.id = any(membership_ids)
    and membership.organization_id = target_group.organization_id
    and membership.team_id = target_group.team_id
    and membership.status = 'active';

  if matched_count <> cardinality(membership_ids) then
    raise exception
      'Every roster membership must be active and belong to the selected category'
      using errcode = '23503';
  end if;

  -- 7. Count distinct memberships assigned to other WorkGroups.
  select count(distinct assignment.team_player_membership_id)
  into transferred_count
  from public.group_player_assignments assignment
  where assignment.team_player_membership_id = any(membership_ids)
    and assignment.status = 'active'
    and assignment.group_id <> target_group.id;

  -- 8. End previous stable assignments.
  update public.group_player_assignments assignment
  set
    status = 'ended',
    ended_at = greatest(
      current_date,
      assignment.assigned_at
    )
  where assignment.team_player_membership_id = any(membership_ids)
    and assignment.status = 'active'
    and assignment.group_id <> target_group.id;

  -- 9. Insert only missing active assignments.
  insert into public.group_player_assignments(
    organization_id,
    team_id,
    group_id,
    team_player_membership_id
  )
  select
    target_group.organization_id,
    target_group.team_id,
    target_group.id,
    membership.id
  from public.team_player_memberships membership
  where membership.id = any(membership_ids)
    and not exists (
      select 1
      from public.group_player_assignments assignment
      where assignment.team_player_membership_id = membership.id
        and assignment.group_id = target_group.id
        and assignment.status = 'active'
    );

  get diagnostics inserted_count = row_count;

  -- assigned_count = new active assignments inserted.
  -- moved_count = distinct memberships transferred from other groups.
  assigned_count := inserted_count;
  moved_count := transferred_count;

  return next;
end;
$$;

alter function
  public.assign_team_roster_players_to_workgroup(uuid, uuid[])
owner to postgres;

revoke all on function
  public.assign_team_roster_players_to_workgroup(uuid, uuid[])
from public, anon, authenticated;

grant execute on function
  public.assign_team_roster_players_to_workgroup(uuid, uuid[])
to authenticated;

commit;
