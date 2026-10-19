-- Manual provisioning for one pre-created Supabase Auth account.
-- Run only after migration 024. Replace the placeholder with the Auth user's UUID.
-- No passwords, access tokens, or service-role keys belong in this script.
begin;

set local app.demo_viewer_profile_id = '00000000-0000-0000-0000-000000000000';

do $$
declare
  v_profile_id uuid := nullif(current_setting('app.demo_viewer_profile_id', true), '')::uuid;
  v_organization_id uuid;
  v_existing_organization_id uuid;
begin
  if v_profile_id is null or v_profile_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Set app.demo_viewer_profile_id to the dedicated demo Auth profile UUID';
  end if;
  if not exists (select 1 from public.profiles where id = v_profile_id) then
    raise exception 'The selected demo viewer profile does not exist';
  end if;
  if exists (select 1 from public.organization_memberships where user_id = v_profile_id and active)
     or exists (select 1 from public.group_memberships where user_id = v_profile_id and active) then
    raise exception 'The selected account has active staff memberships and cannot be a dedicated Demo Viewer';
  end if;
  select id into strict v_organization_id
  from public.organizations
  where slug = 'torino-nord-academy-demo' and name = 'Torino Nord Academy — DEMO';

  select organization_id into v_existing_organization_id
  from public.demo_viewer_access
  where user_id = v_profile_id;
  if v_existing_organization_id is not null and v_existing_organization_id <> v_organization_id then
    raise exception 'This Auth account already has an incompatible Demo Viewer assignment';
  end if;
  insert into public.demo_viewer_access(user_id, organization_id, role, active)
  values (v_profile_id, v_organization_id, 'demo_viewer', true)
  on conflict (user_id) do nothing;
  if not exists (
    select 1 from public.demo_viewer_access
    where user_id = v_profile_id and organization_id = v_organization_id
      and role = 'demo_viewer' and active
  ) then
    raise exception 'The existing Demo Viewer assignment is inactive or incompatible; review it manually';
  end if;
end;
$$;

-- Verification runs INSIDE the transaction so SET LOCAL is still available.
-- Expected: exactly one row with the supplied UUID, role demo_viewer and active=true.
select access_row.user_id, access_row.role, access_row.active,
       organization_row.name, organization_row.slug
from public.demo_viewer_access access_row
join public.organizations organization_row on organization_row.id = access_row.organization_id
where access_row.user_id = current_setting('app.demo_viewer_profile_id')::uuid;

commit;
