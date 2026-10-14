begin;

alter table public.groups add constraint groups_id_organization_team_key unique (id, organization_id, team_id);

create table public.team_player_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  team_id uuid not null,
  player_id uuid not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'left', 'archived')),
  joined_at date not null default current_date,
  left_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (team_id, organization_id) references public.teams(id, organization_id) on delete restrict,
  foreign key (player_id, organization_id) references public.players(id, organization_id) on delete restrict,
  unique (id, organization_id, team_id),
  check (left_at is null or left_at >= joined_at),
  check ((status = 'active' and left_at is null) or (status <> 'active'))
);
create unique index team_player_memberships_one_active_idx on public.team_player_memberships(team_id, player_id) where status = 'active';

create table public.group_player_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  team_id uuid not null,
  group_id uuid not null,
  team_player_membership_id uuid not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'ended')),
  assigned_at date not null default current_date,
  ended_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (team_player_membership_id, organization_id, team_id) references public.team_player_memberships(id, organization_id, team_id) on delete restrict,
  foreign key (group_id, organization_id, team_id) references public.groups(id, organization_id, team_id) on delete restrict,
  check (ended_at is null or ended_at >= assigned_at),
  check ((status = 'active' and ended_at is null) or (status <> 'active'))
);
create unique index group_player_assignments_one_active_idx on public.group_player_assignments(team_player_membership_id) where status = 'active';

alter table public.team_player_memberships enable row level security;
alter table public.group_player_assignments enable row level security;
create trigger touch_team_player_membership before update on public.team_player_memberships for each row execute function private.touch_and_protect();
create trigger touch_group_player_assignment before update on public.group_player_assignments for each row execute function private.touch_and_protect();
revoke all on public.team_player_memberships, public.group_player_assignments from anon, authenticated;
grant select, insert, update on public.team_player_memberships, public.group_player_assignments to authenticated;
create policy team_membership_read on public.team_player_memberships for select to authenticated using ((select private.can_access_team(team_id)));
create policy team_membership_write on public.team_player_memberships for all to authenticated using ((select private.is_admin(organization_id))) with check ((select private.is_admin(organization_id)));
create policy group_assignment_read on public.group_player_assignments for select to authenticated using ((select private.can_access_group(group_id)));
create policy group_assignment_write on public.group_player_assignments for all to authenticated using ((select private.is_admin(organization_id))) with check ((select private.is_admin(organization_id)));

commit;
