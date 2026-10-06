begin;

-- The original helper inherited the owner of the migration session. On a remote
-- project that owner may not bypass RLS, causing the helper to recurse through
-- organization_memberships and return false during INSERT WITH CHECK.
create or replace function private.is_admin(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
      where membership.organization_id = org
      and membership.user_id = (select auth.uid())
      and membership.role = 'admin'
      and membership.active = true
  );
$$;

alter function private.is_admin(uuid) owner to postgres;
revoke all on function private.is_admin(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;

grant insert, update on table public.groups to authenticated;

drop policy if exists group_insert on public.groups;
create policy group_insert
on public.groups
for insert
to authenticated
with check ((select private.is_admin(organization_id)));

drop policy if exists group_edit on public.groups;
create policy group_edit
on public.groups
for update
to authenticated
using ((select private.is_admin(organization_id)))
with check ((select private.is_admin(organization_id)));

commit;
