begin;

create function public.import_group_player(
  p_player_id uuid,
  p_organization_id uuid,
  p_group_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_year integer,
  p_season text,
  p_membership_type text default 'roster',
  p_status text default 'active',
  p_joined_at date default current_date,
  p_left_at date default null,
  p_previous_roles text[] default '{}',
  p_ideal_roles text[] default '{}',
  p_goalkeeper_candidate boolean default false
)
returns table(player_id uuid, membership_id uuid, player_created boolean, membership_created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization uuid;
  normalized_first_name text := btrim(p_first_name);
  normalized_last_name text := btrim(coalesce(p_last_name, ''));
  normalized_season text := btrim(p_season);
  existing_player public.players;
  existing_membership public.group_player_memberships;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_player_id is null or p_organization_id is null or p_group_id is null then
    raise exception 'Player, organization and group are required' using errcode = '22023';
  end if;
  if normalized_first_name is null or normalized_first_name = '' or char_length(normalized_first_name) > 120 then
    raise exception 'Player first name must contain 1 to 120 characters' using errcode = '22023';
  end if;
  if char_length(normalized_last_name) > 120 then
    raise exception 'Player last name must contain at most 120 characters' using errcode = '22023';
  end if;
  if p_birth_year is not null and p_birth_year not between 1900 and 2100 then
    raise exception 'Player birth year is invalid' using errcode = '22023';
  end if;
  if normalized_season is null or normalized_season = '' or char_length(normalized_season) > 30 then
    raise exception 'Membership season must contain 1 to 30 characters' using errcode = '22023';
  end if;
  if p_membership_type not in ('roster', 'guest') or p_status not in ('active', 'inactive', 'left', 'archived') then
    raise exception 'Membership type or status is invalid' using errcode = '22023';
  end if;
  if p_joined_at is null or (p_left_at is not null and p_left_at < p_joined_at) then
    raise exception 'Membership dates are invalid' using errcode = '22023';
  end if;

  select g.organization_id into target_organization
  from public.groups g
  where g.id = p_group_id;

  if target_organization is null or target_organization <> p_organization_id then
    raise exception 'Group does not belong to the requested organization' using errcode = '23503';
  end if;
  if not private.has_player_permission(p_group_id, 'players.create') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;

  insert into public.players(id, organization_id, first_name, last_name, birth_year)
  values (p_player_id, p_organization_id, normalized_first_name, normalized_last_name, p_birth_year)
  on conflict (id) do nothing
  returning * into existing_player;
  player_created := found;

  if not player_created then
    select * into existing_player from public.players where id = p_player_id for update;
  end if;

  if existing_player.organization_id <> p_organization_id
    or existing_player.first_name <> normalized_first_name
    or existing_player.last_name <> normalized_last_name
    or existing_player.birth_year is distinct from p_birth_year
    or existing_player.archived_at is not null then
    raise exception 'Player UUID already exists with incompatible data' using errcode = '23505';
  end if;

  insert into public.group_player_memberships(
    organization_id, group_id, player_id, season, status, membership_type,
    joined_at, left_at, previous_roles, ideal_roles, goalkeeper_candidate
  ) values (
    p_organization_id, p_group_id, p_player_id, normalized_season, p_status, p_membership_type,
    p_joined_at, p_left_at, coalesce(p_previous_roles, '{}'), coalesce(p_ideal_roles, '{}'), coalesce(p_goalkeeper_candidate, false)
  )
  on conflict on constraint group_player_memberships_group_id_player_id_season_key do nothing
  returning * into existing_membership;
  membership_created := found;

  if not membership_created then
    select roster.* into existing_membership
    from public.group_player_memberships roster
    where roster.group_id = p_group_id and roster.player_id = p_player_id and roster.season = normalized_season
    for update;
  end if;

  if existing_membership.organization_id <> p_organization_id
    or existing_membership.status <> p_status
    or existing_membership.membership_type <> p_membership_type
    or existing_membership.joined_at <> p_joined_at
    or existing_membership.left_at is distinct from p_left_at
    or existing_membership.previous_roles is distinct from coalesce(p_previous_roles, '{}')
    or existing_membership.ideal_roles is distinct from coalesce(p_ideal_roles, '{}')
    or existing_membership.goalkeeper_candidate <> coalesce(p_goalkeeper_candidate, false) then
    raise exception 'Group player membership already exists with incompatible data' using errcode = '23505';
  end if;

  player_id := existing_player.id;
  membership_id := existing_membership.id;
  return next;
end;
$$;

alter function public.import_group_player(uuid,uuid,uuid,text,text,integer,text,text,text,date,date,text[],text[],boolean) owner to postgres;
revoke all on function public.import_group_player(uuid,uuid,uuid,text,text,integer,text,text,text,date,date,text[],text[],boolean) from public, anon;
grant execute on function public.import_group_player(uuid,uuid,uuid,text,text,integer,text,text,text,date,date,text[],text[],boolean) to authenticated;

commit;
