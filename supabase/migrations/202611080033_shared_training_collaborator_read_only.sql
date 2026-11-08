-- GP-ST-04: collaborators may consume shared training content, but never write it.
-- This deliberately ignores training.edit overrides for collaborator memberships.

begin;

create or replace function private.has_training_permission(grp uuid, requested text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = grp
      and (
        (requested in ('training.view', 'templates.view')
          and g.active
          and private.is_demo_viewer_for_organization(g.organization_id))
        or private.is_admin(g.organization_id)
        or (
          g.active
          and exists (
            select 1
            from public.group_memberships m
            where m.group_id = g.id
              and m.user_id = auth.uid()
              and m.active
              and (
                m.role = 'coach'
                or (
                  m.role = 'collaborator'
                  and requested in ('training.view', 'templates.view')
                  and coalesce((
                    select p.enabled
                    from public.collaborator_permissions p
                    where p.membership_id = m.id
                      and p.permission = requested
                  ), true)
                )
              )
          )
        )
      )
  );
$$;

alter function private.has_training_permission(uuid, text) owner to postgres;
revoke all on function private.has_training_permission(uuid, text) from public, anon;
grant execute on function private.has_training_permission(uuid, text) to authenticated;

commit;
