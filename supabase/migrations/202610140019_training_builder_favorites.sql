-- Training Builder V2: personal exercise favorites in a shared organization library.
-- Apply manually after migration 013. No existing exercise or session is changed.
begin;

create table public.exercise_library_favorites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  exercise_id uuid not null references public.exercise_library_items(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (exercise_id, user_id)
);
create index exercise_library_favorites_user_org_idx on public.exercise_library_favorites(user_id, organization_id, created_at desc);

create or replace function private.validate_exercise_library_favorite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare exercise_org uuid;
begin
  select organization_id into exercise_org from public.exercise_library_items where id = new.exercise_id;
  if exercise_org is null or exercise_org <> new.organization_id then
    raise exception 'Favorite and exercise must belong to the same organization' using errcode = '23503';
  end if;
  if new.user_id <> auth.uid() then
    raise exception 'A favorite can only belong to the authenticated user' using errcode = '42501';
  end if;
  return new;
end;
$$;
alter function private.validate_exercise_library_favorite() owner to postgres;
revoke all on function private.validate_exercise_library_favorite() from public, anon, authenticated;
create trigger validate_exercise_library_favorite
  before insert or update of organization_id, exercise_id, user_id
  on public.exercise_library_favorites
  for each row execute function private.validate_exercise_library_favorite();

alter table public.exercise_library_favorites enable row level security;
grant select, insert, delete on public.exercise_library_favorites to authenticated;
create policy exercise_favorite_read on public.exercise_library_favorites for select to authenticated
using (user_id = auth.uid());
create policy exercise_favorite_insert on public.exercise_library_favorites for insert to authenticated
with check (user_id = auth.uid() and exists (
  select 1 from public.exercise_library_items item where item.id = exercise_id
));
create policy exercise_favorite_delete on public.exercise_library_favorites for delete to authenticated
using (user_id = auth.uid());

commit;
