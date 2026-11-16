-- GP-FAM-03: restore the definitive public route for WorkGroup Rosso.
-- This migration only changes the stable route row; family publications are untouched.
begin;

do $$
declare
  target_group_id constant uuid:='49e62956-63dc-449b-a216-181b4ffff70a';
  target_organization_id constant uuid:='fff5f478-a14c-4174-803b-a6ae39724cd5';
  current_season_slug text;
  current_category_slug text;
  current_group_slug text;
  changed_count integer;
begin
  if not exists (
    select 1 from public.groups
    where id=target_group_id and organization_id=target_organization_id
  ) then
    raise exception 'Family route correction blocked: target WorkGroup or organization does not match'
      using errcode='P0001';
  end if;

  select season_slug,category_slug,group_slug
  into current_season_slug,current_category_slug,current_group_slug
  from public.family_public_group_routes
  where group_id=target_group_id
  for update;

  if not found then
    raise exception 'Family route correction blocked: target route does not exist'
      using errcode='P0001';
  end if;

  if current_season_slug<>'2026-27' or current_category_slug<>'pulcini-misti'
     or current_group_slug not in ('rossi','rosso') then
    raise exception 'Family route correction blocked: unexpected current route /%/%/%',current_season_slug,current_category_slug,current_group_slug
      using errcode='P0001';
  end if;

  if exists (
    select 1 from public.family_public_group_routes
    where season_slug='2026-27' and category_slug='pulcini-misti' and group_slug='rosso'
      and group_id<>target_group_id
  ) then
    raise exception 'Family route correction blocked: /2026-27/pulcini-misti/rosso belongs to another WorkGroup'
      using errcode='P0001';
  end if;

  update public.family_public_group_routes
  set group_slug='rosso'
  where group_id=target_group_id and group_slug='rossi';
  get diagnostics changed_count=row_count;

  if current_group_slug='rossi' and changed_count<>1 then
    raise exception 'Family route correction blocked: expected one route update, updated %',changed_count
      using errcode='P0001';
  elsif current_group_slug='rosso' and changed_count<>0 then
    raise exception 'Family route correction blocked: idempotent rerun unexpectedly updated % rows',changed_count
      using errcode='P0001';
  end if;
end $$;

commit;

-- PRE-MIGRATION VERIFICATION (run separately, read-only; expect group_slug "rossi"):
-- select r.group_id,g.organization_id,r.season_slug,r.category_slug,r.group_slug
-- from public.family_public_group_routes r
-- join public.groups g on g.id=r.group_id
-- where r.group_id='49e62956-63dc-449b-a216-181b4ffff70a'
--   and g.organization_id='fff5f478-a14c-4174-803b-a6ae39724cd5';

-- COLLISION VERIFICATION (run separately, read-only; expect zero rows):
-- select group_id
-- from public.family_public_group_routes
-- where season_slug='2026-27' and category_slug='pulcini-misti' and group_slug='rosso'
--   and group_id<>'49e62956-63dc-449b-a216-181b4ffff70a';

-- POST-MIGRATION VERIFICATION (run separately, read-only; expect one row with group_slug "rosso"):
-- select r.group_id,g.organization_id,r.season_slug,r.category_slug,r.group_slug
-- from public.family_public_group_routes r
-- join public.groups g on g.id=r.group_id
-- where r.group_id='49e62956-63dc-449b-a216-181b4ffff70a'
--   and g.organization_id='fff5f478-a14c-4174-803b-a6ae39724cd5'
--   and r.season_slug='2026-27' and r.category_slug='pulcini-misti' and r.group_slug='rosso';
