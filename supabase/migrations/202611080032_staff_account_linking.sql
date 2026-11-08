-- GP-ST-03: verified account acceptance and provenance-safe membership sync.
-- Reviewed fix: serialize staff mutations on the staff-person row, safely move assignments,
-- and preserve memberships created outside this feature.
begin;

create table public.organization_staff_link_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  staff_person_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (staff_person_id, organization_id)
    references public.organization_staff_people(id, organization_id) on delete restrict,
  check (accepted_at is null or revoked_at is null)
);

create table public.organization_staff_managed_memberships (
  assignment_id uuid primary key references public.organization_staff_group_assignments(id) on delete restrict,
  staff_person_id uuid not null,
  organization_id uuid not null,
  group_membership_id uuid not null unique references public.group_memberships(id) on delete cascade,
  created_at timestamptz not null default now(),
  foreign key (staff_person_id, organization_id)
    references public.organization_staff_people(id, organization_id) on delete restrict
);

revoke all on public.organization_staff_link_invitations, public.organization_staff_managed_memberships from public, anon, authenticated;
alter table public.organization_staff_link_invitations enable row level security;
alter table public.organization_staff_managed_memberships enable row level security;

create function private.sync_staff_person_memberships(p_staff_person_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  person public.organization_staff_people%rowtype;
  assignment record;
  membership_id uuid;
  managed_id uuid;
begin
  -- All public mutation RPCs acquire this same lock before touching assignments.
  select * into person from public.organization_staff_people
  where id = p_staff_person_id for update;
  if not found or person.linked_user_id is null then return; end if;

  for assignment in
    select * from public.organization_staff_group_assignments
    where staff_person_id = person.id order by id for update
  loop
    managed_id := null;
    select group_membership_id into managed_id
    from public.organization_staff_managed_memberships
    where assignment_id = assignment.id and staff_person_id = person.id
      and organization_id = person.organization_id for update;

    if managed_id is not null then
      update public.group_memberships
      set role = assignment.intended_role, active = true
      where id = managed_id and group_id = assignment.group_id
        and organization_id = person.organization_id and user_id = person.linked_user_id;
      if not found then
        raise exception 'Managed membership integrity conflict' using errcode = '23503';
      end if;
    else
      membership_id := null;
      select id into membership_id from public.group_memberships
      where group_id = assignment.group_id and user_id = person.linked_user_id for update;
      if membership_id is not null then
        raise exception 'An unmanaged membership already exists for this account and WorkGroup'
          using errcode = '23505';
      end if;
      insert into public.group_memberships(organization_id, group_id, user_id, role, active)
      values(person.organization_id, assignment.group_id, person.linked_user_id,
             assignment.intended_role, true) returning id into membership_id;
      insert into public.organization_staff_managed_memberships
        (assignment_id, staff_person_id, organization_id, group_membership_id)
      values(assignment.id, person.id, person.organization_id, membership_id);
    end if;
  end loop;
end;
$$;
alter function private.sync_staff_person_memberships(uuid) owner to postgres;
revoke all on function private.sync_staff_person_memberships(uuid) from public, anon, authenticated;

create function public.create_staff_account_link_invitation(p_organization_id uuid, p_staff_person_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare raw_token text; person public.organization_staff_people%rowtype;
begin
  if auth.uid() is null or not private.is_admin(p_organization_id) then raise exception 'Organization administrator permission required' using errcode='42501'; end if;
  select * into person from public.organization_staff_people where id=p_staff_person_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Staff person not found' using errcode='P0002'; end if;
  if person.linked_user_id is not null then raise exception 'Staff person already linked' using errcode='23505'; end if;
  update public.organization_staff_link_invitations set revoked_at=now() where staff_person_id=person.id and accepted_at is null and revoked_at is null;
  raw_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  insert into public.organization_staff_link_invitations(organization_id,staff_person_id,token_hash,expires_at)
  values(person.organization_id,person.id,md5(raw_token),now()+interval '7 days');
  return raw_token;
end;
$$;

create function public.accept_staff_account_link(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  invitation public.organization_staff_link_invitations%rowtype;
  person public.organization_staff_people%rowtype;
  accepting_user uuid := auth.uid();
begin
  if accepting_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_token is null or length(p_token) <> 128 or p_token !~ '^[0-9a-f]{128}$' then
    raise exception 'Invitation invalid or expired' using errcode = '22023';
  end if;
  -- Look up without locking first. Lock the person BEFORE the invitation to
  -- match create/revoke and avoid person/invitation lock-order inversion.
  select * into invitation from public.organization_staff_link_invitations
  where token_hash = md5(p_token);
  if not found then
    raise exception 'Invitation invalid or expired' using errcode = '22023';
  end if;
  select * into person from public.organization_staff_people
  where id = invitation.staff_person_id and organization_id = invitation.organization_id for update;
  if not found then
    raise exception 'Invitation invalid or expired' using errcode = '22023';
  end if;
  select * into invitation from public.organization_staff_link_invitations
  where id = invitation.id and staff_person_id = person.id
    and organization_id = person.organization_id for update;
  if not found then
    raise exception 'Invitation invalid or expired' using errcode = '22023';
  end if;
  if invitation.accepted_at is not null then
    -- Idempotent retry only while the same account remains linked.
    if person.linked_user_id = accepting_user then return person.id; end if;
    raise exception 'Invitation already used' using errcode = '22023';
  end if;
  if invitation.revoked_at is not null or invitation.expires_at <= now() then
    raise exception 'Invitation invalid or expired' using errcode = '22023';
  end if;
  if person.linked_user_id is not null then
    raise exception 'Staff person already linked' using errcode = '23505';
  end if;
  if not exists (select 1 from public.profiles where id = accepting_user) then
    raise exception 'Authenticated account has no profile; complete profile setup first'
      using errcode = '23503';
  end if;
  if exists (
    select 1 from public.organization_staff_people
    where organization_id = person.organization_id
      and linked_user_id = accepting_user and id <> person.id
  ) then
    raise exception 'Account already linked in this organization' using errcode = '23505';
  end if;
  update public.organization_staff_people set linked_user_id = accepting_user
  where id = person.id;
  perform private.sync_staff_person_memberships(person.id);
  update public.organization_staff_link_invitations set accepted_at = now()
  where id = invitation.id;
  return person.id;
end;
$$;

create function public.save_staff_group_assignment(
  p_id uuid, p_organization_id uuid, p_staff_person_id uuid, p_group_id uuid, p_role text)
returns public.organization_staff_group_assignments
language plpgsql security definer set search_path = '' as $$
declare
  saved public.organization_staff_group_assignments%rowtype;
  previous public.organization_staff_group_assignments%rowtype;
  person public.organization_staff_people%rowtype;
  managed_membership_id uuid;
begin
  if auth.uid() is null or not private.is_admin(p_organization_id) then
    raise exception 'Organization administrator permission required' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('coach', 'collaborator') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;
  -- Serialize with link acceptance, removal and revocation.
  select * into person from public.organization_staff_people
  where id = p_staff_person_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Staff person not found' using errcode = 'P0002'; end if;
  if not exists (
    select 1 from public.groups where id = p_group_id and organization_id = p_organization_id
  ) then
    raise exception 'WorkGroup not found in the selected organization' using errcode = 'P0002';
  end if;

  if p_id is null then
    insert into public.organization_staff_group_assignments
      (organization_id, staff_person_id, group_id, intended_role)
    values(p_organization_id, p_staff_person_id, p_group_id, p_role)
    on conflict(staff_person_id, group_id)
      do update set intended_role = excluded.intended_role
    returning * into saved;
  else
    select * into previous from public.organization_staff_group_assignments
    where id = p_id and organization_id = p_organization_id
      and staff_person_id = p_staff_person_id for update;
    if not found then
      raise exception 'Staff assignment not found' using errcode = 'P0002';
    end if;

    if previous.group_id is distinct from p_group_id then
      -- A moved assignment must not retain access to its previous group.
      -- Remove ONLY the membership whose provenance points to this assignment.
      managed_membership_id := null;
      select group_membership_id into managed_membership_id
      from public.organization_staff_managed_memberships
      where assignment_id = previous.id and staff_person_id = p_staff_person_id
        and organization_id = p_organization_id for update;
      if managed_membership_id is not null then
        if not exists (
          select 1 from public.group_memberships
          where id = managed_membership_id and group_id = previous.group_id
            and organization_id = p_organization_id
            and user_id = person.linked_user_id
        ) then
          raise exception 'Managed membership integrity conflict' using errcode = '23503';
        end if;
        delete from public.organization_staff_managed_memberships
        where assignment_id = previous.id;
        delete from public.group_memberships where id = managed_membership_id;
      end if;
    end if;

    update public.organization_staff_group_assignments
    set group_id = p_group_id, intended_role = p_role
    where id = previous.id returning * into saved;
  end if;
  perform private.sync_staff_person_memberships(p_staff_person_id);
  return saved;
end;
$$;

create function public.delete_staff_group_assignment(
  p_id uuid, p_organization_id uuid, p_staff_person_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  person public.organization_staff_people%rowtype;
  assignment public.organization_staff_group_assignments%rowtype;
  membership_id uuid;
begin
  if auth.uid() is null or not private.is_admin(p_organization_id) then
    raise exception 'Organization administrator permission required' using errcode = '42501';
  end if;
  select * into person from public.organization_staff_people
  where id = p_staff_person_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Staff person not found' using errcode = 'P0002'; end if;
  select * into assignment from public.organization_staff_group_assignments
  where id = p_id and staff_person_id = person.id
    and organization_id = person.organization_id for update;
  if not found then return; end if; -- Idempotent repeat.
  select group_membership_id into membership_id
  from public.organization_staff_managed_memberships
  where assignment_id = assignment.id and staff_person_id = person.id
    and organization_id = person.organization_id for update;
  if membership_id is not null then
    if not exists (
      select 1 from public.group_memberships
      where id = membership_id and group_id = assignment.group_id
        and organization_id = person.organization_id and user_id = person.linked_user_id
    ) then
      raise exception 'Managed membership integrity conflict' using errcode = '23503';
    end if;
    delete from public.organization_staff_managed_memberships
    where assignment_id = assignment.id;
    delete from public.group_memberships where id = membership_id;
  end if;
  delete from public.organization_staff_group_assignments where id = assignment.id;
end;
$$;

create function public.revoke_staff_account_link(
  p_organization_id uuid, p_staff_person_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  managed record;
  person public.organization_staff_people%rowtype;
begin
  if auth.uid() is null or not private.is_admin(p_organization_id) then
    raise exception 'Organization administrator permission required' using errcode = '42501';
  end if;
  select * into person from public.organization_staff_people
  where id = p_staff_person_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Staff person not found' using errcode = 'P0002'; end if;
  for managed in
    select mm.assignment_id, mm.group_membership_id, a.group_id
    from public.organization_staff_managed_memberships mm
    join public.organization_staff_group_assignments a on a.id = mm.assignment_id
    where mm.staff_person_id = person.id and mm.organization_id = person.organization_id
    order by mm.assignment_id for update of mm
  loop
    if not exists (
      select 1 from public.group_memberships
      where id = managed.group_membership_id and group_id = managed.group_id
        and organization_id = person.organization_id and user_id = person.linked_user_id
    ) then
      raise exception 'Managed membership integrity conflict' using errcode = '23503';
    end if;
    delete from public.organization_staff_managed_memberships
    where assignment_id = managed.assignment_id;
    delete from public.group_memberships where id = managed.group_membership_id;
  end loop;
  update public.organization_staff_people set linked_user_id = null where id = person.id;
  update public.organization_staff_link_invitations
  set revoked_at = coalesce(revoked_at, now())
  where staff_person_id = person.id and accepted_at is null;
end;
$$;

revoke insert, update, delete on public.organization_staff_group_assignments from authenticated;
alter function public.create_staff_account_link_invitation(uuid,uuid) owner to postgres;
alter function public.accept_staff_account_link(text) owner to postgres;
alter function public.save_staff_group_assignment(uuid,uuid,uuid,uuid,text) owner to postgres;
alter function public.delete_staff_group_assignment(uuid,uuid,uuid) owner to postgres;
alter function public.revoke_staff_account_link(uuid,uuid) owner to postgres;
revoke all on function public.create_staff_account_link_invitation(uuid,uuid), public.accept_staff_account_link(text), public.save_staff_group_assignment(uuid,uuid,uuid,uuid,text), public.delete_staff_group_assignment(uuid,uuid,uuid), public.revoke_staff_account_link(uuid,uuid) from public, anon;
grant execute on function public.create_staff_account_link_invitation(uuid,uuid), public.accept_staff_account_link(text), public.save_staff_group_assignment(uuid,uuid,uuid,uuid,text), public.delete_staff_group_assignment(uuid,uuid,uuid), public.revoke_staff_account_link(uuid,uuid) to authenticated;

commit;
