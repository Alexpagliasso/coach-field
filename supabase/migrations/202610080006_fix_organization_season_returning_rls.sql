begin;

drop policy if exists organization_season_read
on public.organization_seasons;

create policy organization_season_read
on public.organization_seasons
for select
to authenticated
using (
  private.is_admin(organization_id)
  or private.can_access_organization_season(id)
);

commit;
