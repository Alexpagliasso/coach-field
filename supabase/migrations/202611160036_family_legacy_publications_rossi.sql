-- GP-FAM-01 FIX: attach the 18 published legacy family records to
-- 2026/27 / Pulcini Misti / Rosso without touching drafts or other groups.
-- Requires 202611160035_family_workgroup_public_routes.sql.
begin;

-- Preserve updated_at as well as reference_date and published_at. The normal
-- touch trigger is disabled only inside this transaction; a rollback restores
-- its previous enabled state automatically.
alter table public.family_publications disable trigger touch_family_publications_updated_at;

do $$
declare
  target_group_id constant uuid:='49e62956-63dc-449b-a216-181b4ffff70a';
  target_organization_id constant uuid:='fff5f478-a14c-4174-803b-a6ae39724cd5';
  legacy_published_count integer;
  already_assigned_count integer;
  legacy_draft_count integer;
  changed_count integer;
  route_season_slug text;
  route_category_slug text;
  route_group_slug text;
begin
  -- UUIDs are authoritative; names and hierarchy are independent guards
  -- against applying this one-off migration to a repurposed WorkGroup.
  if not exists (
    select 1
    from public.groups g
    join public.teams t on t.id=g.team_id and t.organization_id=g.organization_id
    join public.organization_seasons s on s.id=t.season_id and s.organization_id=g.organization_id
    where g.id=target_group_id and g.organization_id=target_organization_id
      and btrim(s.name)='2026/27'
      and lower(btrim(t.name))='pulcini misti'
      and lower(btrim(g.name))='rosso'
  ) then
    raise exception 'Legacy family migration blocked: target UUIDs do not match 2026/27 / Pulcini Misti / Rosso'
      using errcode='P0001';
  end if;

  select season_slug,category_slug,group_slug
  into route_season_slug,route_category_slug,route_group_slug
  from public.family_public_group_routes
  where group_id=target_group_id;

  if not found then
    raise exception 'Legacy family migration blocked: GP-FAM-01 did not create a route for the target WorkGroup'
      using errcode='P0001';
  end if;

  if route_season_slug<>'2026-27' or route_category_slug<>'pulcini-misti' or route_group_slug not in ('rosso','rossi') then
    raise exception 'Legacy family migration blocked: unexpected GP-FAM-01 route /%/%/%',route_season_slug,route_category_slug,route_group_slug
      using errcode='P0001';
  end if;

  if exists (
    select 1 from public.family_public_group_routes
    where season_slug='2026-27' and category_slug='pulcini-misti' and group_slug='rossi'
      and group_id<>target_group_id
  ) then
    raise exception 'Legacy family migration blocked: /2026-27/pulcini-misti/rossi belongs to another WorkGroup'
      using errcode='P0001';
  end if;

  -- Migration 035 canonically derives "rosso" from the real WorkGroup name.
  -- Its schema stores one stable route per group (not a separate aliases
  -- table), so switch that verified route to the requested public alias only
  -- after the collision check above. A rerun already sees "rossi" and is a no-op.
  update public.family_public_group_routes
  set season_slug='2026-27',category_slug='pulcini-misti',group_slug='rossi',updated_at=now()
  where group_id=target_group_id
    and (season_slug,category_slug,group_slug) is distinct from ('2026-27','pulcini-misti','rossi');

  select count(*)::integer into legacy_published_count
  from public.family_publications
  where organization_id=target_organization_id and group_id is null and status='published';

  select count(*)::integer into already_assigned_count
  from public.family_publications
  where organization_id=target_organization_id and group_id=target_group_id and status='published';

  select count(*)::integer into legacy_draft_count
  from public.family_publications
  where organization_id=target_organization_id and group_id is null and status='draft';

  if legacy_published_count=18 then
    update public.family_publications
    set group_id=target_group_id
    where organization_id=target_organization_id and group_id is null and status='published';
    get diagnostics changed_count=row_count;
    if changed_count<>18 then
      raise exception 'Legacy family migration blocked: expected to update 18 published records, updated %',changed_count
        using errcode='P0001';
    end if;
  elsif legacy_published_count=0 and already_assigned_count>=18 then
    changed_count:=0; -- Safe rerun: nothing is rewritten.
  else
    raise exception 'Legacy family migration blocked: expected 18 unassigned published records or a completed rerun, found % unassigned and % assigned',legacy_published_count,already_assigned_count
      using errcode='P0001';
  end if;

  if exists (
    select 1 from public.family_publications
    where organization_id=target_organization_id and status='published' and group_id is null
  ) then
    raise exception 'Legacy family migration blocked: published legacy records remain unassigned'
      using errcode='P0001';
  end if;

  raise notice 'Legacy family publications: % updated; % unassigned drafts intentionally unchanged',changed_count,legacy_draft_count;
end $$;

alter table public.family_publications enable trigger touch_family_publications_updated_at;

commit;

-- PRE-MIGRATION VERIFICATION (run separately, read-only; expect one row,
-- route_group_slug "rosso" or "rossi", legacy_published 18):
-- select g.id group_id,g.organization_id,s.name season,t.name category,g.name workgroup,
--   r.season_slug route_season_slug,r.category_slug route_category_slug,r.group_slug route_group_slug,
--   count(*) filter(where f.status='published' and f.group_id is null) legacy_published,
--   count(*) filter(where f.status='draft' and f.group_id is null) legacy_drafts,
--   count(*) filter(where f.status='published' and f.group_id=g.id) already_assigned
-- from public.groups g
-- join public.teams t on t.id=g.team_id and t.organization_id=g.organization_id
-- join public.organization_seasons s on s.id=t.season_id and s.organization_id=g.organization_id
-- left join public.family_public_group_routes r on r.group_id=g.id
-- left join public.family_publications f on f.organization_id=g.organization_id
-- where g.id='49e62956-63dc-449b-a216-181b4ffff70a'
--   and g.organization_id='fff5f478-a14c-4174-803b-a6ae39724cd5'
-- group by g.id,g.organization_id,s.name,t.name,g.name,r.season_slug,r.category_slug,r.group_slug;

-- POST-MIGRATION VERIFICATION (run separately, read-only):
-- select r.season_slug,r.category_slug,r.group_slug,f.status,
--   count(*) assigned_count,
--   count(*) filter(where f.group_id is null) still_unassigned
-- from public.family_public_group_routes r
-- join public.groups g on g.id=r.group_id
-- left join public.family_publications f on f.organization_id=g.organization_id
--   and (f.group_id=g.id or f.group_id is null)
-- where r.group_id='49e62956-63dc-449b-a216-181b4ffff70a'
--   and g.organization_id='fff5f478-a14c-4174-803b-a6ae39724cd5'
--   and r.season_slug='2026-27' and r.category_slug='pulcini-misti' and r.group_slug='rossi'
-- group by r.season_slug,r.category_slug,r.group_slug,f.status
-- order by f.status;
