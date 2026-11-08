-- GP-ST-01: organization staff directory, deliberately separate from access.
begin;

create table public.organization_staff_people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 120),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 120),
  intended_role text not null check (intended_role in ('coach', 'collaborator')),
  linked_user_id uuid references auth.users(id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create unique index organization_staff_people_linked_user_idx
  on public.organization_staff_people(organization_id, linked_user_id)
  where linked_user_id is not null;
create index organization_staff_people_organization_name_idx
  on public.organization_staff_people(organization_id, last_name, first_name);

create function private.touch_organization_staff_person()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Staff person ownership cannot be changed' using errcode = '42501';
  end if;
  new.first_name := btrim(new.first_name);
  new.last_name := btrim(new.last_name);
  new.updated_at := now();
  return new;
end;
$$;
alter function private.touch_organization_staff_person() owner to postgres;
revoke all on function private.touch_organization_staff_person() from public, anon, authenticated;

create trigger touch_organization_staff_person
before update on public.organization_staff_people
for each row execute function private.touch_organization_staff_person();

alter table public.organization_staff_people enable row level security;
revoke all on public.organization_staff_people from public, anon, authenticated;
grant select on public.organization_staff_people to authenticated;
grant insert (organization_id, first_name, last_name, intended_role)
  on public.organization_staff_people to authenticated;
grant update (first_name, last_name, intended_role)
  on public.organization_staff_people to authenticated;

create policy organization_staff_people_read
on public.organization_staff_people for select to authenticated
using (private.is_admin(organization_id));
create policy organization_staff_people_insert
on public.organization_staff_people for insert to authenticated
with check (private.is_admin(organization_id) and created_by = auth.uid());
create policy organization_staff_people_update
on public.organization_staff_people for update to authenticated
using (private.is_admin(organization_id))
with check (private.is_admin(organization_id) and created_by is not null);

commit;
