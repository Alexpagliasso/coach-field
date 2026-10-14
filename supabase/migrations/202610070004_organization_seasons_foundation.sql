begin;

-- ============================================================
-- ORGANIZATION SEASONS
-- ============================================================

create table public.organization_seasons (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete restrict,

  name text not null
    check (length(btrim(name)) between 1 and 40),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Needed for the composite FK from teams.
  unique (id, organization_id),

  -- One "2026/27" season per organization.
  unique (organization_id, name)
);

create index organization_seasons_organization_id_idx
  on public.organization_seasons(organization_id);


-- ============================================================
-- TEAM → SEASON
-- ============================================================

alter table public.teams
  add column season_id uuid;

alter table public.teams
  add constraint teams_season_organization_fkey
  foreign key (season_id, organization_id)
  references public.organization_seasons(id, organization_id)
  on delete restrict;

create index teams_season_id_idx
  on public.teams(season_id)
  where season_id is not null;


-- ============================================================
-- ACCESS HELPER
-- ============================================================

create function private.can_access_organization_season(
  target_season uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_seasons s
    where s.id = target_season
      and (
        private.is_admin(s.organization_id)
        or exists (
          select 1
          from public.teams t
          where t.season_id = s.id
            and private.can_access_team(t.id)
        )
      )
  );
$$;

alter function private.can_access_organization_season(uuid)
  owner to postgres;

revoke all
  on function private.can_access_organization_season(uuid)
  from public, anon;

grant execute
  on function private.can_access_organization_season(uuid)
  to authenticated;


-- ============================================================
-- RLS
-- ============================================================

alter table public.organization_seasons
  enable row level security;

create trigger touch_organization_season
before update on public.organization_seasons
for each row
execute function private.touch_and_protect();

revoke all
  on public.organization_seasons
  from anon, authenticated;

grant select, insert, update
  on public.organization_seasons
  to authenticated;


-- Admin can read every season of their organization.
-- Coaches/collaborators can read a season when they can access
-- at least one WorkGroup belonging to one of its Teams.
create policy organization_season_read
on public.organization_seasons
for select
to authenticated
using (
  (select private.can_access_organization_season(id))
);


-- Only organization admins create seasons.
create policy organization_season_insert
on public.organization_seasons
for insert
to authenticated
with check (
  (select private.is_admin(organization_id))
);


-- Only organization admins modify seasons.
create policy organization_season_update
on public.organization_seasons
for update
to authenticated
using (
  (select private.is_admin(organization_id))
)
with check (
  (select private.is_admin(organization_id))
);

commit;