begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null, first_name text, last_name text, avatar_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) > 0),
  slug text not null unique, logo_url text, description text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.profiles(id), role text not null default 'admin' check(role = 'admin'),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id, user_id)
);
create table public.groups (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  name text not null check(length(trim(name)) > 0), season text, description text, year_from integer, year_to integer,
  public_visible boolean not null default false, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id, organization_id), check(year_from is null or year_to is null or year_from <= year_to)
);
create table public.group_memberships (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  group_id uuid not null, user_id uuid not null references public.profiles(id),
  role text not null check(role in ('coach','collaborator')), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(group_id, organization_id) references public.groups(id, organization_id), unique(group_id, user_id)
);
create table public.collaborator_permissions (
  id uuid primary key default gen_random_uuid(), membership_id uuid not null references public.group_memberships(id) on delete cascade,
  permission text not null check(permission in (
    'players.view','players.create','players.edit','attendance.view','attendance.edit',
    'training.view','training.create','training.edit','training.evaluate',
    'matches.view','matches.create','matches.edit','matches.evaluate',
    'development.view','development.edit','templates.view','templates.edit',
    'notes.view','notes.create','notes.delete','staff.view'
  )), enabled boolean not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(membership_id, permission)
);
create index on public.organization_memberships(user_id, organization_id) where active;
create index on public.group_memberships(user_id, group_id) where active;
create index on public.groups(organization_id);

create function private.is_admin(org uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_memberships where organization_id = org and user_id = auth.uid() and active and role = 'admin');
$$;
create function private.is_coach(grp uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.group_memberships m join public.groups g on g.id=m.group_id
    where m.group_id=grp and m.user_id=auth.uid() and m.active and m.role='coach' and g.active);
$$;
create function private.can_access_group(grp uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.groups g where g.id=grp and (private.is_admin(g.organization_id) or
    (g.active and exists(select 1 from public.group_memberships m where m.group_id=g.id and m.user_id=auth.uid() and m.active))));
$$;
create function private.can_view_staff(grp uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.groups g where g.id=grp and (private.is_admin(g.organization_id) or private.is_coach(grp) or
    (g.active and exists(select 1 from public.group_memberships m join public.collaborator_permissions p on p.membership_id=m.id
      where m.group_id=grp and m.user_id=auth.uid() and m.active and m.role='collaborator' and p.permission='staff.view' and p.enabled))));
$$;
create function private.can_manage_member(member uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.group_memberships m where m.id=member and m.role='collaborator' and
    (private.is_admin(m.organization_id) or private.is_coach(m.group_id)));
$$;
create function private.can_view_profile(person uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select person=auth.uid() or exists(select 1 from public.group_memberships m where m.user_id=person and private.can_view_staff(m.group_id));
$$;
create function private.can_view_organization(org uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin(org) or exists(select 1 from public.groups g where g.organization_id=org and private.can_access_group(g.id));
$$;

create function private.touch_and_protect() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.created_at <> old.created_at then raise exception 'Immutable identity'; end if;
  if tg_table_name in ('groups','group_memberships','organization_memberships') then
    if new.organization_id <> old.organization_id then raise exception 'Immutable organization'; end if;
  end if;
  if tg_table_name = 'group_memberships' then
    if new.group_id <> old.group_id or new.user_id <> old.user_id then raise exception 'Immutable membership target'; end if;
  end if;
  if tg_table_name = 'organization_memberships' then
    if new.user_id <> old.user_id then raise exception 'Immutable membership target'; end if;
  end if;
  if tg_table_name = 'collaborator_permissions' then
    if new.membership_id <> old.membership_id or new.permission <> old.permission then raise exception 'Immutable override target'; end if;
  end if;
  new.updated_at = now(); return new;
end;
$$;
do $$ declare t text; begin
  foreach t in array array['profiles','organizations','organization_memberships','groups','group_memberships','collaborator_permissions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create trigger touch_and_protect before update on public.%I for each row execute function private.touch_and_protect()', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
grant insert, update on public.groups, public.group_memberships, public.collaborator_permissions to authenticated;
grant update (name, slug, logo_url, description) on public.organizations to authenticated;
grant update (first_name, last_name, avatar_url) on public.profiles to authenticated;

create policy profile_read on public.profiles for select to authenticated using(private.can_view_profile(id));
create policy profile_edit on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy org_read on public.organizations for select to authenticated using(private.can_view_organization(id));
create policy org_edit on public.organizations for update to authenticated using(private.is_admin(id)) with check(private.is_admin(id));
create policy org_members_read on public.organization_memberships for select to authenticated using(user_id=auth.uid() or private.is_admin(organization_id));
-- Organization admins are bootstrapped by a trusted operator, never via self-service frontend writes.
create policy group_read on public.groups for select to authenticated using(private.can_access_group(id));
create policy group_insert on public.groups for insert to authenticated with check(private.is_admin(organization_id));
create policy group_edit on public.groups for update to authenticated using(private.is_admin(organization_id)) with check(private.is_admin(organization_id));
create policy members_read on public.group_memberships for select to authenticated using((user_id=auth.uid() and private.can_access_group(group_id)) or private.can_view_staff(group_id));
create policy members_insert on public.group_memberships for insert to authenticated with check(private.is_admin(organization_id) or (role='collaborator' and private.is_coach(group_id) and user_id<>auth.uid()));
create policy members_edit on public.group_memberships for update to authenticated using(private.is_admin(organization_id) or (role='collaborator' and private.is_coach(group_id))) with check(private.is_admin(organization_id) or (role='collaborator' and private.is_coach(group_id) and user_id<>auth.uid()));
create policy permissions_read on public.collaborator_permissions for select to authenticated using(exists(select 1 from public.group_memberships m where m.id=membership_id and ((m.user_id=auth.uid() and m.active and private.can_access_group(m.group_id)) or private.can_view_staff(m.group_id))));
create policy permissions_insert on public.collaborator_permissions for insert to authenticated with check(private.can_manage_member(membership_id));
create policy permissions_edit on public.collaborator_permissions for update to authenticated using(private.can_manage_member(membership_id)) with check(private.can_manage_member(membership_id));

create function private.sync_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email) values(new.id,coalesce(new.email,'')) on conflict(id) do update set email=excluded.email;
  return new;
end;
$$;
create trigger sync_staff_profile after insert or update of email on auth.users for each row execute function private.sync_profile();
insert into public.profiles(id,email) select id,coalesce(email,'') from auth.users on conflict(id) do nothing;

-- Narrow public projection: no direct anonymous SELECT on any staff table.
create function public.public_group_directory() returns table(id uuid, name text, season text, description text, organization_name text)
language sql stable security definer set search_path = '' as $$
  select g.id,g.name,g.season,g.description,o.name from public.groups g join public.organizations o on o.id=g.organization_id where g.public_visible and g.active order by o.name,g.name;
$$;
create function public.assign_group_staff(target_group uuid, target_email text, target_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare org uuid; person uuid; existing_role text;
begin
  select organization_id into org from public.groups where id=target_group;
  if org is null or target_role not in ('coach','collaborator') then raise exception 'Invalid assignment'; end if;
  if not private.is_admin(org) and not (private.is_coach(target_group) and target_role='collaborator') then raise exception 'Permission denied'; end if;
  select id into person from public.profiles where lower(email)=lower(trim(target_email));
  if person is null then raise exception 'Staff non disponibile: creare prima l account tramite amministrazione Supabase'; end if;
  select role into existing_role from public.group_memberships where group_id=target_group and user_id=person for update;
  if not private.is_admin(org) and (person=auth.uid() or existing_role='coach') then raise exception 'Permission denied'; end if;
  insert into public.group_memberships(organization_id,group_id,user_id,role) values(org,target_group,person,target_role)
    on conflict(group_id,user_id) do update set role=excluded.role,active=true
    where private.is_admin(org) or public.group_memberships.role='collaborator';
end;
$$;
revoke all on all functions in schema private from public;
grant execute on function private.is_admin(uuid), private.is_coach(uuid), private.can_access_group(uuid), private.can_view_staff(uuid), private.can_manage_member(uuid), private.can_view_profile(uuid), private.can_view_organization(uuid) to authenticated;
revoke all on function public.public_group_directory() from public;
grant execute on function public.public_group_directory() to anon, authenticated;
revoke all on function public.assign_group_staff(uuid,text,text) from public;
grant execute on function public.assign_group_staff(uuid,text,text) to authenticated;
commit;
