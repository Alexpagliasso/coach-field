-- GrowPitch V1.0: reversible match visibility and WorkGroup family content.
-- Apply manually after migration 202610200025_family_publications.sql.
begin;

-- Test matches remain stored with their Live history, call-ups and statistics.
-- Ordinary repositories explicitly select is_hidden = false.
alter table public.matches
  add column if not exists is_hidden boolean not null default false;

create index if not exists matches_visible_group_date_idx
  on public.matches (group_id, match_date desc, start_time desc)
  where is_hidden = false;

-- Existing match policies also allow coaches to edit sporting fields. Visibility
-- is an administrative archival decision, so protect just this column change.
create or replace function private.guard_match_visibility_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_hidden is distinct from old.is_hidden
     and (auth.uid() is null or not private.is_admin(old.organization_id)) then
    raise exception 'Only organization administrators can change match visibility'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
alter function private.guard_match_visibility_change() owner to postgres;
revoke all on function private.guard_match_visibility_change() from public, anon, authenticated;
drop trigger if exists guard_match_visibility_change on public.matches;
create trigger guard_match_visibility_change
before update on public.matches
for each row execute function private.guard_match_visibility_change();

-- NULL keeps pre-existing publications as general, organization-level content.
-- The composite FK prevents attaching a publication to a WorkGroup belonging
-- to a different organization.
alter table public.family_publications
  add column if not exists group_id uuid;
alter table public.family_publications
  drop constraint if exists family_publications_group_organization_fkey;
alter table public.family_publications
  add constraint family_publications_group_organization_fkey
  foreign key (group_id, organization_id)
  references public.groups(id, organization_id)
  on delete restrict;

create index if not exists family_publications_group_feed_idx
  on public.family_publications (group_id, reference_date desc, created_at desc)
  where status = 'published' and group_id is not null;

-- An anonymous family reader receives only a nullable WorkGroup UUID alongside
-- an already-public record; no group name, organization, player or staff data
-- is granted. This supports client-side scope selection without a private-table
-- lookup. Existing published-only RLS remains unchanged.
grant select (group_id) on public.family_publications to anon;

commit;
