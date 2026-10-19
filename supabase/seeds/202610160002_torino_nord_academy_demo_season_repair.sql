-- GrowPitch demo repair: connect Torino Nord Academy — DEMO to season 2026/27
--
-- Manual-only administrative repair. Run in Supabase SQL Editor only after
-- reviewing the read-only pre-flight output below. It is limited to the
-- organization whose slug is exactly `torino-nord-academy-demo`.
--
-- This repair preserves all existing UUIDs and sport data. It creates no
-- players, sessions, matches, call-ups or line-ups, and it never deletes data.

-- PRE-REPAIR CHECKS (read-only)
-- The expected pre-repair state is one demo organization, one Pulcini U10
-- category with season_id NULL, and Blu/Rosso linked to that category.
select o.id as organization_id, o.name, o.slug
from public.organizations o
where o.slug = 'torino-nord-academy-demo';

select s.id as season_id, s.name as season_name, s.organization_id
from public.organization_seasons s
join public.organizations o on o.id = s.organization_id
where o.slug = 'torino-nord-academy-demo'
order by s.name, s.id;

select t.id as team_id, t.name as category_name, t.season as legacy_season,
       t.season_id, s.name as linked_season
from public.teams t
join public.organizations o on o.id = t.organization_id
left join public.organization_seasons s
  on s.id = t.season_id and s.organization_id = t.organization_id
where o.slug = 'torino-nord-academy-demo'
order by t.name, t.id;

select g.id as group_id, g.name as group_name, g.season as legacy_season,
       g.team_id, t.name as category_name, t.season_id
from public.groups g
join public.organizations o on o.id = g.organization_id
left join public.teams t
  on t.id = g.team_id and t.organization_id = g.organization_id
where o.slug = 'torino-nord-academy-demo'
order by g.name, g.id;

begin;

do $$
declare
  v_organization_id uuid;
  v_season_id uuid;
  v_team_id uuid;
  v_current_season_id uuid;
  v_count integer;
begin
  -- Serialize only repairs for this explicitly named demo organization.
  perform pg_advisory_xact_lock(hashtext('growpitch:torino-nord-academy-demo:season-repair:v1'));

  if to_regclass('public.organization_seasons') is null then
    raise exception 'organization_seasons is missing: apply migration 202610070004 before this repair';
  end if;

  select count(*), (array_agg(id order by id))[1]
    into v_count, v_organization_id
  from public.organizations
  where slug = 'torino-nord-academy-demo';
  if v_count <> 1 then
    raise exception 'Expected exactly one organization with the demo slug, found %', v_count;
  end if;
  if not exists (
    select 1 from public.organizations
    where id = v_organization_id and name = 'Torino Nord Academy — DEMO'
  ) then
    raise exception 'Refusing to repair a demo slug associated with a different organization name';
  end if;

  -- The unique (organization_id, name) constraint prevents a second 2026/27
  -- season. More than one row is treated as an existing data conflict.
  select count(*), (array_agg(id order by id))[1]
    into v_count, v_season_id
  from public.organization_seasons
  where organization_id = v_organization_id and name = '2026/27';
  if v_count = 0 then
    insert into public.organization_seasons(organization_id, name)
    values (v_organization_id, '2026/27')
    returning id into v_season_id;
  elsif v_count <> 1 then
    raise exception 'Expected at most one 2026/27 demo season, found %', v_count;
  end if;

  -- Locate the category created by the original demo seed. Do not create a
  -- replacement category: existing groups and sport records retain this UUID.
  select count(*), (array_agg(id order by id))[1]
    into v_count, v_team_id
  from public.teams
  where organization_id = v_organization_id and name = 'Pulcini U10';
  if v_count <> 1 then
    raise exception 'Expected exactly one demo category Pulcini U10, found %', v_count;
  end if;

  select season_id into v_current_season_id
  from public.teams
  where id = v_team_id and organization_id = v_organization_id;
  if (select season from public.teams where id = v_team_id) is distinct from '2026/27' then
    raise exception 'Pulcini U10 has an unexpected legacy season; review it manually before linking';
  end if;
  if v_current_season_id is not null and v_current_season_id <> v_season_id then
    raise exception 'Pulcini U10 is already linked to a different season; review it manually before linking';
  end if;

  -- Blu and Rosso must already be the existing WorkGroups of this category.
  -- Their IDs, players, sessions and matches are deliberately untouched.
  select count(*) into v_count
  from public.groups
  where organization_id = v_organization_id and team_id = v_team_id
    and name = 'Blu' and season = '2026/27';
  if v_count <> 1 then
    raise exception 'Expected exactly one existing Blu group in Pulcini U10, found %', v_count;
  end if;
  select count(*) into v_count
  from public.groups
  where organization_id = v_organization_id and team_id = v_team_id
    and name = 'Rosso' and season = '2026/27';
  if v_count <> 1 then
    raise exception 'Expected exactly one existing Rosso group in Pulcini U10, found %', v_count;
  end if;

  -- The only mutation: attach the existing category to the existing/new demo
  -- season. The composite FK guarantees both rows belong to the same org.
  update public.teams
  set season_id = v_season_id
  where id = v_team_id
    and organization_id = v_organization_id
    and season_id is null;

  if not exists (
    select 1 from public.teams
    where id = v_team_id and organization_id = v_organization_id
      and season_id = v_season_id
  ) then
    raise exception 'Pulcini U10 was not linked to the demo 2026/27 season';
  end if;
end;
$$;

commit;

-- POST-REPAIR CHECKS (read-only)
-- Expected: exactly one 2026/27 season, one linked Pulcini U10 category,
-- and the existing Blu/Rosso groups under that category.
select o.id as organization_id, o.name, s.id as season_id, s.name as season_name
from public.organizations o
join public.organization_seasons s on s.organization_id = o.id
where o.slug = 'torino-nord-academy-demo' and s.name = '2026/27';

select t.id as team_id, t.name as category_name, t.season as legacy_season,
       t.season_id, s.name as season_name
from public.teams t
join public.organizations o on o.id = t.organization_id
join public.organization_seasons s
  on s.id = t.season_id and s.organization_id = t.organization_id
where o.slug = 'torino-nord-academy-demo'
  and t.name = 'Pulcini U10' and s.name = '2026/27';

select g.id as group_id, g.name as group_name, g.team_id,
       t.name as category_name, s.name as season_name
from public.groups g
join public.organizations o on o.id = g.organization_id
join public.teams t
  on t.id = g.team_id and t.organization_id = g.organization_id
join public.organization_seasons s
  on s.id = t.season_id and s.organization_id = t.organization_id
where o.slug = 'torino-nord-academy-demo'
  and t.name = 'Pulcini U10' and s.name = '2026/27'
  and g.name in ('Blu', 'Rosso')
order by g.name;

-- No sport record is moved or created by the repair; these counts should be
-- unchanged from before it ran.
select
  (select count(*) from public.players p where p.organization_id = o.id) as players,
  (select count(*) from public.training_sessions ts where ts.organization_id = o.id) as training_sessions,
  (select count(*) from public.matches m where m.organization_id = o.id) as matches
from public.organizations o
where o.slug = 'torino-nord-academy-demo';
