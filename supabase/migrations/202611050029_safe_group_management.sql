-- GP-ORG-02/03: organization audit and Superadmin-only atomic deletion.
begin;

-- Global privilege registry. It deliberately lives outside public, has no API
-- grants and cannot be populated by an application user. Provisioning requires
-- a trusted database operator and an already existing auth.users UUID.
create table private.superadmins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now()
);
revoke all on table private.superadmins from public, anon, authenticated;

create function private.is_superadmin(person uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select person is not null and exists (
    select 1 from private.superadmins superadmin where superadmin.user_id = person
  );
$$;
alter function private.is_superadmin(uuid) owner to postgres;
revoke all on function private.is_superadmin(uuid) from public, anon, authenticated;

create function public.current_user_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.is_superadmin(auth.uid()) $$;
alter function public.current_user_is_superadmin() owner to postgres;
revoke all on function public.current_user_is_superadmin() from public, anon;
grant execute on function public.current_user_is_superadmin() to authenticated;

create or replace function public.get_organization_group_dependency_audit(p_organization_id uuid)
returns table (
  group_id uuid, organization_id uuid, group_name text, legacy_season text,
  team_id uuid, team_name text, season_id uuid, season_name text, active boolean,
  staff_memberships bigint, player_memberships bigint, player_assignments bigint,
  training_sessions bigint, matches bigint, family_publications bigint,
  source_match_callups bigint, can_delete boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (private.is_admin(p_organization_id) or private.is_superadmin(auth.uid())) then
    raise exception 'Organization administrator permission required' using errcode = '42501';
  end if;

  return query
  select g.id, g.organization_id, g.name, g.season,
    g.team_id, t.name, s.id, s.name, g.active,
    (select count(*) from public.group_memberships gm where gm.group_id = g.id),
    (select count(*) from public.group_player_memberships pm where pm.group_id = g.id),
    (select count(*) from public.group_player_assignments pa where pa.group_id = g.id),
    (select count(*) from public.training_sessions ts where ts.group_id = g.id),
    (select count(*) from public.matches m where m.group_id = g.id),
    (select count(*) from public.family_publications fp where fp.group_id = g.id),
    (select count(*) from public.match_callups mc where mc.source_group_id = g.id),
    not exists (select 1 from public.group_player_memberships pm where pm.group_id = g.id)
      and not exists (select 1 from public.group_player_assignments pa where pa.group_id = g.id)
      and not exists (select 1 from public.training_sessions ts where ts.group_id = g.id)
      and not exists (select 1 from public.matches m where m.group_id = g.id)
      and not exists (select 1 from public.family_publications fp where fp.group_id = g.id)
      and not exists (select 1 from public.match_callups mc where mc.source_group_id = g.id)
  from public.groups g
  left join public.teams t on t.id = g.team_id and t.organization_id = g.organization_id
  left join public.organization_seasons s on s.id = t.season_id and s.organization_id = g.organization_id
  where g.organization_id = p_organization_id
  order by coalesce(s.name, g.season, ''), coalesce(t.name, ''), g.name, g.id;
end;
$$;

create or replace function public.delete_empty_organization_group(
  p_organization_id uuid,
  p_group_id uuid,
  p_confirmation_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.groups%rowtype;
  blockers jsonb;
begin
  if auth.uid() is null or not private.is_superadmin(auth.uid()) then
    raise exception 'Global Superadmin permission required' using errcode = '42501';
  end if;

  select * into target
  from public.groups
  where id = p_group_id and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'WorkGroup not found in the selected organization' using errcode = 'P0002';
  end if;
  if p_confirmation_name is null or p_confirmation_name <> target.name then
    raise exception 'The confirmation name does not match the WorkGroup' using errcode = '22023';
  end if;

  -- FOR UPDATE conflicts with the key-share lock required by new FK rows. The
  -- counts and delete therefore remain atomic even if another client writes.
  blockers := jsonb_build_object(
    'playerMemberships', (select count(*) from public.group_player_memberships where group_id = target.id),
    'playerAssignments', (select count(*) from public.group_player_assignments where group_id = target.id),
    'trainingSessions', (select count(*) from public.training_sessions where group_id = target.id),
    'matches', (select count(*) from public.matches where group_id = target.id),
    'familyPublications', (select count(*) from public.family_publications where group_id = target.id),
    'sourceMatchCallups', (select count(*) from public.match_callups where source_group_id = target.id)
  );

  if exists (select 1 from jsonb_each_text(blockers) item where item.value::bigint > 0) then
    raise exception 'WorkGroup has operational dependencies: %', blockers using errcode = '23503';
  end if;

  -- These are access bindings, not sports data. collaborator_permissions are
  -- removed by the existing membership FK and no other table is cascaded.
  delete from public.group_memberships
  where group_id = target.id and organization_id = target.organization_id;

  delete from public.groups
  where id = target.id and organization_id = target.organization_id;

  if not found then
    raise exception 'Concurrent WorkGroup deletion detected' using errcode = '40001';
  end if;
  return target.id;
end;
$$;

alter function public.get_organization_group_dependency_audit(uuid) owner to postgres;
alter function public.delete_empty_organization_group(uuid, uuid, text) owner to postgres;
revoke all on function public.get_organization_group_dependency_audit(uuid) from public, anon;
revoke all on function public.delete_empty_organization_group(uuid, uuid, text) from public, anon;
grant execute on function public.get_organization_group_dependency_audit(uuid) to authenticated;
grant execute on function public.delete_empty_organization_group(uuid, uuid, text) to authenticated;

commit;
