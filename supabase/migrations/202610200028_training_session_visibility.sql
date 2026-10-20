-- GrowPitch V1.0: reversible training-session visibility.
-- Apply manually after migration 202610200027_family_public_group_links.sql.
begin;

-- Hidden sessions keep their exercises, attendance, notes and Field Mode data.
-- Ordinary repositories explicitly read only is_hidden = false.
alter table public.training_sessions
  add column if not exists is_hidden boolean not null default false;

create index if not exists training_sessions_visible_group_date_idx
  on public.training_sessions (group_id, session_date desc, start_time desc)
  where is_hidden = false;

-- Training editors can update session fields under the existing RLS policy.
-- Visibility is instead an organization-level archival decision.
create or replace function private.guard_training_session_visibility_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_hidden is distinct from old.is_hidden
     and (auth.uid() is null or not private.is_admin(old.organization_id)) then
    raise exception 'Only organization administrators can change training session visibility'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
alter function private.guard_training_session_visibility_change() owner to postgres;
revoke all on function private.guard_training_session_visibility_change() from public, anon, authenticated;
drop trigger if exists guard_training_session_visibility_change on public.training_sessions;
create trigger guard_training_session_visibility_change
before update on public.training_sessions
for each row execute function private.guard_training_session_visibility_change();

commit;
