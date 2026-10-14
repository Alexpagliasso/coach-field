begin;

-- A WorkGroup roster is the active assignment of a category membership. The
-- operation is deliberately atomic: no profile or category membership remains
-- when its WorkGroup assignment cannot be created.
-- Remove the pre-release signature, if this migration was partially installed.
drop function if exists public.create_workgroup_roster_player(uuid, uuid, uuid, uuid, text, text, integer);

create or replace function public.create_workgroup_roster_player(
  p_organization_id uuid,
  p_team_id uuid,
  p_group_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_year integer default null
)
returns table(player_id uuid, membership_id uuid, assignment_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_player_id uuid := gen_random_uuid();
  created_membership_id uuid;
  created_assignment_id uuid;
  normalized_first_name text := btrim(coalesce(p_first_name, ''));
  normalized_last_name text := btrim(coalesce(p_last_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_organization_id is null or p_team_id is null or p_group_id is null then
    raise exception 'Organization, category and WorkGroup are required' using errcode = '22023';
  end if;
  if char_length(normalized_first_name) not between 1 and 120
     or char_length(normalized_last_name) not between 1 and 120 then
    raise exception 'Player first and last name must contain 1 to 120 characters' using errcode = '22023';
  end if;
  if p_birth_year is not null and p_birth_year not between 1900 and 2100 then
    raise exception 'Player birth year is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.groups group_row
    where group_row.id = p_group_id
      and group_row.organization_id = p_organization_id
      and group_row.team_id = p_team_id
      and group_row.active is true
  ) then
    raise exception 'WorkGroup does not belong to the requested category' using errcode = '23503';
  end if;
  if not private.has_player_permission(p_group_id, 'players.create') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  insert into public.players(id, organization_id, first_name, last_name, birth_year)
  values (created_player_id, p_organization_id, normalized_first_name, normalized_last_name, p_birth_year);
  insert into public.team_player_memberships(organization_id, team_id, player_id)
  values (p_organization_id, p_team_id, created_player_id)
  returning id into created_membership_id;
  insert into public.group_player_assignments(organization_id, team_id, group_id, team_player_membership_id)
  values (p_organization_id, p_team_id, p_group_id, created_membership_id)
  returning id into created_assignment_id;

  player_id := created_player_id;
  membership_id := created_membership_id;
  assignment_id := created_assignment_id;
  return next;
end;
$$;

-- This predicate is used by the existing players UPDATE policy. Keep the
-- previous cloud-membership rule while adding the current WorkGroup model;
-- otherwise existing organization players would become unexpectedly read-only.
create or replace function private.can_update_player(target_player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.players player
    where player.id = target_player
      and (
        private.is_admin(player.organization_id)
        or exists (
          select 1
          from public.group_player_memberships legacy_membership
          where legacy_membership.player_id = player.id
            and legacy_membership.status = 'active'
            and private.has_player_permission(legacy_membership.group_id, 'players.edit')
        )
        or exists (
          select 1
          from public.group_player_assignments assignment
          join public.team_player_memberships membership
            on membership.id = assignment.team_player_membership_id
           and membership.organization_id = assignment.organization_id
           and membership.team_id = assignment.team_id
          where membership.player_id = player.id
            and membership.organization_id = player.organization_id
            and membership.status = 'active'
            and assignment.status = 'active'
            and private.has_player_permission(assignment.group_id, 'players.edit')
        )
      )
  );
$$;

-- The former category-wide read predicate exposed every category player to a
-- coach who could access any WorkGroup in that category. A non-admin can now
-- read a profile only through an active assignment they are allowed to view.
create or replace function private.can_read_player(target_player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.players player
    where player.id = target_player
      and (
        private.is_admin(player.organization_id)
        or exists (
          select 1
          from public.group_player_memberships legacy_membership
          where legacy_membership.player_id = player.id
            and legacy_membership.status = 'active'
            and private.has_player_permission(legacy_membership.group_id, 'players.view')
        )
        or exists (
          select 1
          from public.group_player_assignments assignment
          join public.team_player_memberships membership
            on membership.id = assignment.team_player_membership_id
           and membership.organization_id = assignment.organization_id
           and membership.team_id = assignment.team_id
          where membership.player_id = player.id
            and membership.organization_id = player.organization_id
            and membership.status = 'active'
            and assignment.status = 'active'
            and private.has_player_permission(assignment.group_id, 'players.view')
        )
      )
  );
$$;

alter function public.create_workgroup_roster_player(uuid, uuid, uuid, text, text, integer) owner to postgres;
alter function private.can_update_player(uuid) owner to postgres;
alter function private.can_read_player(uuid) owner to postgres;
revoke all on function public.create_workgroup_roster_player(uuid, uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.create_workgroup_roster_player(uuid, uuid, uuid, text, text, integer) to authenticated;
revoke all on function private.can_update_player(uuid) from public, anon;
grant execute on function private.can_update_player(uuid) to authenticated;
revoke all on function private.can_read_player(uuid) from public, anon;
grant execute on function private.can_read_player(uuid) to authenticated;

commit;
