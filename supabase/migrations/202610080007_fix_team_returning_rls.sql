begin;

drop policy if exists team_read
on public.teams;

create policy team_read
on public.teams
for select
to authenticated
using (
  private.is_admin(organization_id)
  or private.can_access_team(id)
);

commit;
