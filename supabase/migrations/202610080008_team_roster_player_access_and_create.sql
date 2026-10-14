begin;

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
          from public.group_player_memberships roster
          where roster.player_id = player.id
            and roster.status = 'active'
            and private.has_player_permission(roster.group_id, 'players.view')
        )
        or exists (
          select 1
          from public.team_player_memberships team_roster
          where team_roster.player_id = player.id
            and team_roster.organization_id = player.organization_id
            and team_roster.status = 'active'
            and exists (
              select 1
              from public.groups team_group
              where team_group.team_id = team_roster.team_id
                and private.has_player_permission(team_group.id, 'players.view')
            )
        )
      )
  );
$$;

alter function private.can_read_player(uuid) owner to postgres;
revoke all on function private.can_read_player(uuid) from public, anon;
grant execute on function private.can_read_player(uuid) to authenticated;

create function public.create_team_roster_player(
  p_player_id uuid,
  p_organization_id uuid,
  p_team_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_year integer default null
)
returns table(player_id uuid, membership_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization uuid;
  normalized_first_name text := btrim(p_first_name);
  normalized_last_name text := btrim(p_last_name);
  created_membership_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_player_id is null or p_organization_id is null or p_team_id is null then
    raise exception 'Player, organization and team are required' using errcode = '22023';
  end if;
  if normalized_first_name is null or char_length(normalized_first_name) not between 1 and 120 then
    raise exception 'Player first name must contain 1 to 120 characters' using errcode = '22023';
  end if;
  if normalized_last_name is null or char_length(normalized_last_name) not between 1 and 120 then
    raise exception 'Player last name must contain 1 to 120 characters' using errcode = '22023';
  end if;
  if p_birth_year is not null and p_birth_year not between 1900 and 2100 then
    raise exception 'Player birth year is invalid' using errcode = '22023';
  end if;

  select team.organization_id into target_organization
  from public.teams team
  where team.id = p_team_id;

  if target_organization is null or target_organization <> p_organization_id then
    raise exception 'Team does not belong to the requested organization' using errcode = '23503';
  end if;
  if not private.is_admin(p_organization_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  insert into public.players(id, organization_id, first_name, last_name, birth_year)
  values (p_player_id, p_organization_id, normalized_first_name, normalized_last_name, p_birth_year);

  insert into public.team_player_memberships(organization_id, team_id, player_id)
  values (p_organization_id, p_team_id, p_player_id)
  returning id into created_membership_id;

  player_id := p_player_id;
  membership_id := created_membership_id;
  return next;
end;
$$;

alter function public.create_team_roster_player(uuid,uuid,uuid,text,text,integer) owner to postgres;
revoke all on function public.create_team_roster_player(uuid,uuid,uuid,text,text,integer) from public, anon;
grant execute on function public.create_team_roster_player(uuid,uuid,uuid,text,text,integer) to authenticated;

commit;
