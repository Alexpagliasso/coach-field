begin;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  first_name text not null check (length(btrim(first_name)) between 1 and 120),
  last_name text not null default '' check (length(btrim(last_name)) <= 120),
  birth_year integer check (birth_year between 1900 and 2100),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create table public.group_player_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  group_id uuid not null,
  player_id uuid not null,
  season text not null check (length(btrim(season)) between 1 and 30),
  status text not null default 'active' check (status in ('active', 'inactive', 'left', 'archived')),
  membership_type text not null default 'roster' check (membership_type in ('roster', 'guest')),
  joined_at date not null default current_date,
  left_at date,
  previous_roles text[] not null default '{}',
  ideal_roles text[] not null default '{}',
  goalkeeper_candidate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (group_id, organization_id) references public.groups(id, organization_id) on delete restrict,
  foreign key (player_id, organization_id) references public.players(id, organization_id) on delete restrict,
  unique (group_id, player_id, season),
  check (left_at is null or left_at >= joined_at)
);

create index players_organization_idx on public.players(organization_id);
create index group_player_memberships_group_idx on public.group_player_memberships(group_id, status);
create index group_player_memberships_player_idx on public.group_player_memberships(player_id);

create function private.has_player_permission(grp uuid, requested_permission text)
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
        private.is_admin(g.organization_id)
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
                  and coalesce(
                    (select permission.enabled
                     from public.collaborator_permissions permission
                     where permission.membership_id = m.id
                       and permission.permission = requested_permission),
                    requested_permission in ('players.view')
                  )
                )
              )
          )
        )
      )
  );
$$;

create function private.can_create_organization_player(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin(org) or exists (
    select 1 from public.groups g
    where g.organization_id = org
      and private.has_player_permission(g.id, 'players.create')
  );
$$;

create function private.can_read_player(target_player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.players player
    where player.id = target_player
      and (
        private.is_admin(player.organization_id)
        or exists (
          select 1
          from public.group_player_memberships roster
          where roster.player_id = player.id
            and private.has_player_permission(roster.group_id, 'players.view')
        )
      )
  );
$$;

create function private.can_update_player(target_player uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.players player
    where player.id = target_player
      and (
        private.is_admin(player.organization_id)
        or exists (
          select 1
          from public.group_player_memberships roster
          where roster.player_id = player.id
            and private.has_player_permission(roster.group_id, 'players.edit')
        )
      )
  );
$$;

alter function private.has_player_permission(uuid, text) owner to postgres;
alter function private.can_create_organization_player(uuid) owner to postgres;
alter function private.can_read_player(uuid) owner to postgres;
alter function private.can_update_player(uuid) owner to postgres;

revoke all on function private.has_player_permission(uuid, text) from public, anon;
revoke all on function private.can_create_organization_player(uuid) from public, anon;
revoke all on function private.can_read_player(uuid) from public, anon;
revoke all on function private.can_update_player(uuid) from public, anon;
grant execute on function private.has_player_permission(uuid, text) to authenticated;
grant execute on function private.can_create_organization_player(uuid) to authenticated;
grant execute on function private.can_read_player(uuid) to authenticated;
grant execute on function private.can_update_player(uuid) to authenticated;

alter table public.players enable row level security;
alter table public.group_player_memberships enable row level security;
create trigger touch_player before update on public.players for each row execute function private.touch_and_protect();
create trigger touch_group_player_membership before update on public.group_player_memberships for each row execute function private.touch_and_protect();

revoke all on public.players, public.group_player_memberships from anon, authenticated;
grant select on public.players, public.group_player_memberships to authenticated;
grant insert (id, organization_id, first_name, last_name, birth_year) on public.players to authenticated;
grant update (first_name, last_name, birth_year, archived_at) on public.players to authenticated;
grant insert (id, organization_id, group_id, player_id, season, status, membership_type, joined_at, left_at, previous_roles, ideal_roles, goalkeeper_candidate)
  on public.group_player_memberships to authenticated;
grant update (season, status, membership_type, joined_at, left_at, previous_roles, ideal_roles, goalkeeper_candidate)
  on public.group_player_memberships to authenticated;

create policy player_read on public.players for select to authenticated
  using ((select private.can_read_player(id)));
create policy player_insert on public.players for insert to authenticated
  with check ((select private.can_create_organization_player(organization_id)));
create policy player_update on public.players for update to authenticated
  using ((select private.can_update_player(id)))
  with check ((select private.can_update_player(id)));

create policy group_player_membership_read on public.group_player_memberships for select to authenticated
  using ((select private.has_player_permission(group_id, 'players.view')));
create policy group_player_membership_insert on public.group_player_memberships for insert to authenticated
  with check ((select private.has_player_permission(group_id, 'players.create')));
create policy group_player_membership_update on public.group_player_memberships for update to authenticated
  using ((select private.has_player_permission(group_id, 'players.edit')))
  with check ((select private.has_player_permission(group_id, 'players.edit')));

commit;
