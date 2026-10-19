-- GrowPitch: authenticated, read-only access to Torino Nord Academy — DEMO.
--
-- This migration does not create Auth users or grant staff memberships. A
-- provisioned Demo Viewer can read only the demo organization and cannot use
-- the existing staff roles or write paths.
begin;

create table public.demo_viewer_access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  role text not null default 'demo_viewer' check (role = 'demo_viewer'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index demo_viewer_access_organization_idx
  on public.demo_viewer_access(organization_id)
  where active;

-- A Demo Viewer row can only ever target the explicitly named fictional
-- organization. This also protects against an accidental privileged insert.
create or replace function private.validate_demo_viewer_access()
returns trigger-- GrowPitch: authenticated, read-only access to Torino Nord Academy — DEMO.
--
-- This migration does not create Auth users or grant staff memberships. A
-- provisioned Demo Viewer can read only the demo organization and cannot use
-- the existing staff roles or write paths.
begin;

create table public.demo_viewer_access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  role text not null default 'demo_viewer' check (role = 'demo_viewer'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index demo_viewer_access_organization_idx
  on public.demo_viewer_access(organization_id)
  where active;

-- A Demo Viewer row can only ever target the explicitly named fictional
-- organization. This also protects against an accidental privileged insert.
create or replace function private.validate_demo_viewer_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialize demo provisioning against staff membership changes for this user.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 11024));
  if exists (
    select 1 from public.organization_memberships membership
    where membership.user_id = new.user_id and membership.active
  ) or exists (
    select 1 from public.group_memberships membership
    where membership.user_id = new.user_id and membership.active
  ) then
    raise exception 'Demo Viewer accounts cannot have active staff memberships'
      using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.organizations organization_row
    where organization_row.id = new.organization_id
      and organization_row.slug = 'torino-nord-academy-demo'
      and organization_row.name = 'Torino Nord Academy — DEMO'
  ) then
    raise exception 'Demo Viewer access can only target Torino Nord Academy — DEMO'
      using errcode = '23503';
  end if;
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'Demo Viewer user is immutable' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

alter function private.validate_demo_viewer_access() owner to postgres;
revoke all on function private.validate_demo_viewer_access() from public, anon, authenticated;

create trigger validate_demo_viewer_access
before insert or update on public.demo_viewer_access
for each row execute function private.validate_demo_viewer_access();

-- Keep the separation true after provisioning as well: a dedicated Demo
-- Viewer account cannot later receive an active organization or group role.
create or replace function private.prevent_demo_viewer_staff_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Same per-user lock as demo provisioning trigger.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 11024));
  if new.active and exists (
    select 1 from public.demo_viewer_access access_row
    where access_row.user_id = new.user_id and access_row.active
  ) then
    raise exception 'An active Demo Viewer account cannot receive a staff membership'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

alter function private.prevent_demo_viewer_staff_membership() owner to postgres;
revoke all on function private.prevent_demo_viewer_staff_membership() from public, anon, authenticated;
create trigger prevent_demo_viewer_organization_membership
before insert or update on public.organization_memberships
for each row execute function private.prevent_demo_viewer_staff_membership();
create trigger prevent_demo_viewer_group_membership
before insert or update on public.group_memberships
for each row execute function private.prevent_demo_viewer_staff_membership();

alter table public.demo_viewer_access enable row level security;
revoke all on public.demo_viewer_access from public, anon, authenticated;
grant select on public.demo_viewer_access to authenticated;
create policy demo_viewer_access_read_own
on public.demo_viewer_access
for select to authenticated
using (user_id = auth.uid());

create or replace function private.is_demo_viewer_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.demo_viewer_access access_row
      join public.organizations organization_row
        on organization_row.id = access_row.organization_id
      where access_row.user_id = auth.uid()
        and access_row.active
        and access_row.role = 'demo_viewer'
        and organization_row.slug = 'torino-nord-academy-demo'
        and organization_row.name = 'Torino Nord Academy — DEMO'
    );
$$;

create or replace function private.is_demo_viewer_for_organization(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_organization_id is not null
    and private.is_demo_viewer_account()
    and exists (
      select 1
      from public.demo_viewer_access access_row
      where access_row.user_id = auth.uid()
        and access_row.organization_id = p_organization_id
        and access_row.active
        and access_row.role = 'demo_viewer'
    );
$$;

alter function private.is_demo_viewer_account() owner to postgres;
alter function private.is_demo_viewer_for_organization(uuid) owner to postgres;
revoke all on function private.is_demo_viewer_account(), private.is_demo_viewer_for_organization(uuid)
  from public, anon;
grant execute on function private.is_demo_viewer_account(), private.is_demo_viewer_for_organization(uuid)
  to authenticated;

-- Read helpers gain a narrow viewer branch. No write permission name is ever
-- accepted by these branches.
create or replace function private.can_access_group(grp uuid)
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
        or (g.active and private.is_demo_viewer_for_organization(g.organization_id))
        or (g.active and exists (
          select 1 from public.group_memberships m
          where m.group_id = g.id and m.user_id = auth.uid() and m.active
        ))
      )
  );
$$;

create or replace function private.can_view_organization(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin(org)
    or private.is_demo_viewer_for_organization(org)
    or exists (
      select 1 from public.groups g
      where g.organization_id = org and private.can_access_group(g.id)
    );
$$;

create or replace function private.can_access_team(target_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teams t
    where t.id = target_team
      and (
        private.is_admin(t.organization_id)
        or private.is_demo_viewer_for_organization(t.organization_id)
        or exists (
          select 1 from public.groups g
          where g.team_id = t.id and private.can_access_group(g.id)
        )
      )
  );
$$;

create or replace function private.can_access_organization_season(target_season uuid)
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
        or private.is_demo_viewer_for_organization(s.organization_id)
        or exists (
          select 1 from public.teams t
          where t.season_id = s.id and private.can_access_team(t.id)
        )
      )
  );
$$;

create or replace function private.has_player_permission(grp uuid, requested_permission text)
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
        (requested_permission = 'players.view'
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
                or (m.role = 'collaborator' and coalesce(
                  (select p.enabled from public.collaborator_permissions p
                   where p.membership_id = m.id and p.permission = requested_permission),
                  requested_permission = 'players.view'
                ))
              )
          )
        )
      )
  );
$$;

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
            where m.group_id = g.id and m.user_id = auth.uid() and m.active
              and (m.role = 'coach' or (
                m.role = 'collaborator' and coalesce((
                  select p.enabled from public.collaborator_permissions p
                  where p.membership_id = m.id and p.permission = requested
                ), requested in ('training.view', 'templates.view'))
              ))
          )
        )
      )
  );
$$;

create or replace function private.has_match_permission(grp uuid, requested text)
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
        (requested = 'matches.view'
          and g.active
          and private.is_demo_viewer_for_organization(g.organization_id))
        or private.is_admin(g.organization_id)
        or (
          g.active
          and exists (
            select 1
            from public.group_memberships m
            where m.group_id = g.id and m.user_id = auth.uid() and m.active
              and (m.role = 'coach' or (
                m.role = 'collaborator' and coalesce((
                  select p.enabled from public.collaborator_permissions p
                  where p.membership_id = m.id and p.permission = requested
                ), requested = 'matches.view')
              ))
          )
        )
      )
  );
$$;

alter function private.can_access_group(uuid) owner to postgres;
alter function private.can_view_organization(uuid) owner to postgres;
alter function private.can_access_team(uuid) owner to postgres;
alter function private.can_access_organization_season(uuid) owner to postgres;
alter function private.has_player_permission(uuid, text) owner to postgres;
alter function private.has_training_permission(uuid, text) owner to postgres;
alter function private.has_match_permission(uuid, text) owner to postgres;
grant execute on function private.can_access_group(uuid), private.can_view_organization(uuid),
  private.can_access_team(uuid), private.can_access_organization_season(uuid),
  private.has_player_permission(uuid, text), private.has_training_permission(uuid, text),
  private.has_match_permission(uuid, text) to authenticated;

-- The only authenticated self-service organization bootstrap must reject the
-- demo account even if it calls the RPC directly instead of using the UI.
create or replace function public.bootstrap_organization(p_name text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_name text := btrim(p_name);
  slug_base text;
  organization_id uuid := gen_random_uuid();
  created_organization public.organizations;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if private.is_demo_viewer_account() then raise exception 'Demo Viewer accounts cannot create organizations' using errcode = '42501'; end if;
  if normalized_name is null or normalized_name = '' then raise exception 'Organization name is required' using errcode = '22023'; end if;
  if char_length(normalized_name) > 120 then raise exception 'Organization name must be 120 characters or fewer' using errcode = '22023'; end if;
  slug_base := trim(both '-' from lower(regexp_replace(normalized_name, '[^a-zA-Z0-9]+', '-', 'g')));
  if slug_base = '' then slug_base := 'organization'; end if;
  slug_base := left(slug_base, 60);
  insert into public.organizations (id, name, slug)
  values (organization_id, normalized_name, slug_base || '-' || replace(organization_id::text, '-', ''))
  returning * into created_organization;
  insert into public.organization_memberships (organization_id, user_id, role, active)
  values (organization_id, caller_id, 'admin', true);
  return created_organization;
end;
$$;

alter function public.bootstrap_organization(text) owner to postgres;
revoke all on function public.bootstrap_organization(text) from public, anon;
grant execute on function public.bootstrap_organization(text) to authenticated;

-- The existing profile policy is otherwise the only direct UPDATE available to
-- every authenticated user. A Demo Viewer has no application data to edit.
drop policy if exists profile_edit on public.profiles;
create policy profile_edit on public.profiles
for update to authenticated
using (id = auth.uid() and not private.is_demo_viewer_account())
with check (id = auth.uid() and not private.is_demo_viewer_account());

-- Favorites are the only self-owned application rows otherwise writable by an
-- authenticated viewer. Keep the demo account strictly read-only.
drop policy if exists exercise_favorite_insert on public.exercise_library_favorites;
drop policy if exists exercise_favorite_delete on public.exercise_library_favorites;
create policy exercise_favorite_insert on public.exercise_library_favorites
for insert to authenticated
with check (
  not private.is_demo_viewer_account()
  and user_id = auth.uid()
  and exists (select 1 from public.exercise_library_items item where item.id = exercise_id)
);
create policy exercise_favorite_delete on public.exercise_library_favorites
for delete to authenticated
using (not private.is_demo_viewer_account() and user_id = auth.uid());

commit;

language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.organization_memberships membership
    where membership.user_id = new.user_id and membership.active
  ) or exists (
    select 1 from public.group_memberships membership
    where membership.user_id = new.user_id and membership.active
  ) then
    raise exception 'Demo Viewer accounts cannot have active staff memberships'
      using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.organizations organization_row
    where organization_row.id = new.organization_id
      and organization_row.slug = 'torino-nord-academy-demo'
      and organization_row.name = 'Torino Nord Academy — DEMO'
  ) then
    raise exception 'Demo Viewer access can only target Torino Nord Academy — DEMO'
      using errcode = '23503';
  end if;
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'Demo Viewer user is immutable' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

alter function private.validate_demo_viewer_access() owner to postgres;
revoke all on function private.validate_demo_viewer_access() from public, anon, authenticated;

create trigger validate_demo_viewer_access
before insert or update on public.demo_viewer_access
for each row execute function private.validate_demo_viewer_access();

-- Keep the separation true after provisioning as well: a dedicated Demo
-- Viewer account cannot later receive an active organization or group role.
create or replace function private.prevent_demo_viewer_staff_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active and exists (
    select 1 from public.demo_viewer_access access_row
    where access_row.user_id = new.user_id and access_row.active
  ) then
    raise exception 'An active Demo Viewer account cannot receive a staff membership'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

alter function private.prevent_demo_viewer_staff_membership() owner to postgres;
revoke all on function private.prevent_demo_viewer_staff_membership() from public, anon, authenticated;
create trigger prevent_demo_viewer_organization_membership
before insert or update of user_id, active on public.organization_memberships
for each row execute function private.prevent_demo_viewer_staff_membership();
create trigger prevent_demo_viewer_group_membership
before insert or update of user_id, active on public.group_memberships
for each row execute function private.prevent_demo_viewer_staff_membership();

alter table public.demo_viewer_access enable row level security;
revoke all on public.demo_viewer_access from public, anon, authenticated;
grant select on public.demo_viewer_access to authenticated;
create policy demo_viewer_access_read_own
on public.demo_viewer_access
for select to authenticated
using (user_id = auth.uid());

create or replace function private.is_demo_viewer_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.demo_viewer_access access_row
      join public.organizations organization_row
        on organization_row.id = access_row.organization_id
      where access_row.user_id = auth.uid()
        and access_row.active
        and access_row.role = 'demo_viewer'
        and organization_row.slug = 'torino-nord-academy-demo'
        and organization_row.name = 'Torino Nord Academy — DEMO'
    );
$$;

create or replace function private.is_demo_viewer_for_organization(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_organization_id is not null
    and private.is_demo_viewer_account()
    and exists (
      select 1
      from public.demo_viewer_access access_row
      where access_row.user_id = auth.uid()
        and access_row.organization_id = p_organization_id
        and access_row.active
        and access_row.role = 'demo_viewer'
    );
$$;

alter function private.is_demo_viewer_account() owner to postgres;
alter function private.is_demo_viewer_for_organization(uuid) owner to postgres;
revoke all on function private.is_demo_viewer_account(), private.is_demo_viewer_for_organization(uuid)
  from public, anon;
grant execute on function private.is_demo_viewer_account(), private.is_demo_viewer_for_organization(uuid)
  to authenticated;

-- Read helpers gain a narrow viewer branch. No write permission name is ever
-- accepted by these branches.
create or replace function private.can_access_group(grp uuid)
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
        or (g.active and private.is_demo_viewer_for_organization(g.organization_id))
        or (g.active and exists (
          select 1 from public.group_memberships m
          where m.group_id = g.id and m.user_id = auth.uid() and m.active
        ))
      )
  );
$$;

create or replace function private.can_view_organization(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin(org)
    or private.is_demo_viewer_for_organization(org)
    or exists (
      select 1 from public.groups g
      where g.organization_id = org and private.can_access_group(g.id)
    );
$$;

create or replace function private.can_access_team(target_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teams t
    where t.id = target_team
      and (
        private.is_admin(t.organization_id)
        or private.is_demo_viewer_for_organization(t.organization_id)
        or exists (
          select 1 from public.groups g
          where g.team_id = t.id and private.can_access_group(g.id)
        )
      )
  );
$$;

create or replace function private.can_access_organization_season(target_season uuid)
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
        or private.is_demo_viewer_for_organization(s.organization_id)
        or exists (
          select 1 from public.teams t
          where t.season_id = s.id and private.can_access_team(t.id)
        )
      )
  );
$$;

create or replace function private.has_player_permission(grp uuid, requested_permission text)
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
        (requested_permission = 'players.view'
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
                or (m.role = 'collaborator' and coalesce(
                  (select p.enabled from public.collaborator_permissions p
                   where p.membership_id = m.id and p.permission = requested_permission),
                  requested_permission = 'players.view'
                ))
              )
          )
        )
      )
  );
$$;

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
            where m.group_id = g.id and m.user_id = auth.uid() and m.active
              and (m.role = 'coach' or (
                m.role = 'collaborator' and coalesce((
                  select p.enabled from public.collaborator_permissions p
                  where p.membership_id = m.id and p.permission = requested
                ), requested in ('training.view', 'templates.view'))
              ))
          )
        )
      )
  );
$$;

create or replace function private.has_match_permission(grp uuid, requested text)
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
        (requested = 'matches.view'
          and g.active
          and private.is_demo_viewer_for_organization(g.organization_id))
        or private.is_admin(g.organization_id)
        or (
          g.active
          and exists (
            select 1
            from public.group_memberships m
            where m.group_id = g.id and m.user_id = auth.uid() and m.active
              and (m.role = 'coach' or (
                m.role = 'collaborator' and coalesce((
                  select p.enabled from public.collaborator_permissions p
                  where p.membership_id = m.id and p.permission = requested
                ), requested = 'matches.view')
              ))
          )
        )
      )
  );
$$;

alter function private.can_access_group(uuid) owner to postgres;
alter function private.can_view_organization(uuid) owner to postgres;
alter function private.can_access_team(uuid) owner to postgres;
alter function private.can_access_organization_season(uuid) owner to postgres;
alter function private.has_player_permission(uuid, text) owner to postgres;
alter function private.has_training_permission(uuid, text) owner to postgres;
alter function private.has_match_permission(uuid, text) owner to postgres;
grant execute on function private.can_access_group(uuid), private.can_view_organization(uuid),
  private.can_access_team(uuid), private.can_access_organization_season(uuid),
  private.has_player_permission(uuid, text), private.has_training_permission(uuid, text),
  private.has_match_permission(uuid, text) to authenticated;

-- The only authenticated self-service organization bootstrap must reject the
-- demo account even if it calls the RPC directly instead of using the UI.
create or replace function public.bootstrap_organization(p_name text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_name text := btrim(p_name);
  slug_base text;
  organization_id uuid := gen_random_uuid();
  created_organization public.organizations;
begin
  if caller_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if private.is_demo_viewer_account() then raise exception 'Demo Viewer accounts cannot create organizations' using errcode = '42501'; end if;
  if normalized_name is null or normalized_name = '' then raise exception 'Organization name is required' using errcode = '22023'; end if;
  if char_length(normalized_name) > 120 then raise exception 'Organization name must be 120 characters or fewer' using errcode = '22023'; end if;
  slug_base := trim(both '-' from lower(regexp_replace(normalized_name, '[^a-zA-Z0-9]+', '-', 'g')));
  if slug_base = '' then slug_base := 'organization'; end if;
  slug_base := left(slug_base, 60);
  insert into public.organizations (id, name, slug)
  values (organization_id, normalized_name, slug_base || '-' || replace(organization_id::text, '-', ''))
  returning * into created_organization;
  insert into public.organization_memberships (organization_id, user_id, role, active)
  values (organization_id, caller_id, 'admin', true);
  return created_organization;
end;
$$;

alter function public.bootstrap_organization(text) owner to postgres;
revoke all on function public.bootstrap_organization(text) from public, anon;
grant execute on function public.bootstrap_organization(text) to authenticated;

-- The existing profile policy is otherwise the only direct UPDATE available to
-- every authenticated user. A Demo Viewer has no application data to edit.
drop policy if exists profile_edit on public.profiles;
create policy profile_edit on public.profiles
for update to authenticated
using (id = auth.uid() and not private.is_demo_viewer_account())
with check (id = auth.uid() and not private.is_demo_viewer_account());

-- Favorites are the only self-owned application rows otherwise writable by an
-- authenticated viewer. Keep the demo account strictly read-only.
drop policy if exists exercise_favorite_insert on public.exercise_library_favorites;
drop policy if exists exercise_favorite_delete on public.exercise_library_favorites;
create policy exercise_favorite_insert on public.exercise_library_favorites
for insert to authenticated
with check (
  not private.is_demo_viewer_account()
  and user_id = auth.uid()
  and exists (select 1 from public.exercise_library_items item where item.id = exercise_id)
);
create policy exercise_favorite_delete on public.exercise_library_favorites
for delete to authenticated
using (not private.is_demo_viewer_account() and user_id = auth.uid());

commit;
