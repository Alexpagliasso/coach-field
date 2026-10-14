begin;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 120),
  season text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

alter table public.groups add column team_id uuid;
alter table public.groups add constraint groups_team_organization_fkey
  foreign key (team_id, organization_id) references public.teams(id, organization_id) on delete restrict;
create index groups_team_id_idx on public.groups(team_id) where team_id is not null;

create function private.can_access_team(target_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.teams t where t.id = target_team and (
      private.is_admin(t.organization_id) or exists (
        select 1 from public.groups g where g.team_id = t.id and private.can_access_group(g.id)
      )
    )
  );
$$;
alter function private.can_access_team(uuid) owner to postgres;
revoke all on function private.can_access_team(uuid) from public, anon;
grant execute on function private.can_access_team(uuid) to authenticated;

alter table public.teams enable row level security;
create trigger touch_team before update on public.teams for each row execute function private.touch_and_protect();
revoke all on public.teams from anon, authenticated;
grant select, insert, update on public.teams to authenticated;
create policy team_read on public.teams for select to authenticated using ((select private.can_access_team(id)));
create policy team_insert on public.teams for insert to authenticated with check ((select private.is_admin(organization_id)));
create policy team_update on public.teams for update to authenticated using ((select private.is_admin(organization_id))) with check ((select private.is_admin(organization_id)));

commit;
