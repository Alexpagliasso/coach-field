-- GP-ST-02: planned staff assignments. These rows never grant application access.
begin;

create table public.organization_staff_group_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  staff_person_id uuid not null,
  group_id uuid not null,
  intended_role text not null check (intended_role in ('coach', 'collaborator')),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (staff_person_id, organization_id)
    references public.organization_staff_people(id, organization_id) on delete restrict,
  foreign key (group_id, organization_id)
    references public.groups(id, organization_id) on delete restrict,
  unique (staff_person_id, group_id)
);

create index organization_staff_group_assignments_organization_idx
  on public.organization_staff_group_assignments(organization_id, staff_person_id);
create index organization_staff_group_assignments_group_idx
  on public.organization_staff_group_assignments(group_id);

create function private.touch_organization_staff_group_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.staff_person_id is distinct from old.staff_person_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Staff assignment ownership cannot be changed' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
alter function private.touch_organization_staff_group_assignment() owner to postgres;
revoke all on function private.touch_organization_staff_group_assignment() from public, anon, authenticated;

create trigger touch_organization_staff_group_assignment
before update on public.organization_staff_group_assignments
for each row execute function private.touch_organization_staff_group_assignment();

alter table public.organization_staff_group_assignments enable row level security;
revoke all on public.organization_staff_group_assignments from public, anon, authenticated;
grant select on public.organization_staff_group_assignments to authenticated;
grant insert (organization_id, staff_person_id, group_id, intended_role)
  on public.organization_staff_group_assignments to authenticated;
grant update (group_id, intended_role)
  on public.organization_staff_group_assignments to authenticated;
grant delete on public.organization_staff_group_assignments to authenticated;

create policy organization_staff_group_assignment_read
on public.organization_staff_group_assignments for select to authenticated
using (private.is_admin(organization_id));
create policy organization_staff_group_assignment_insert
on public.organization_staff_group_assignments for insert to authenticated
with check (private.is_admin(organization_id) and created_by = auth.uid());
create policy organization_staff_group_assignment_update
on public.organization_staff_group_assignments for update to authenticated
using (private.is_admin(organization_id))
with check (private.is_admin(organization_id) and created_by is not null);
create policy organization_staff_group_assignment_delete
on public.organization_staff_group_assignments for delete to authenticated
using (private.is_admin(organization_id));

commit;
