-- GrowPitch: curated, sanitized family-facing publications.
-- This table intentionally stores independent public copy: it never exposes
-- training notes, attendance, call-ups, player data, or source-record IDs.
begin;

create table public.family_publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_type text not null check (content_type in ('training', 'objective', 'match_reflection')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  public_content text not null check (char_length(btrim(public_content)) between 1 and 4000),
  reference_date date not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published') = (publish-- GrowPitch V1.0 — Family publications
-- Apply ONCE in Supabase SQL Editor, after reviewing.
-- Public feed: all explicitly published entries across organizations are readable.
-- Drafts remain visible only to authorized organization admins.
-- This migration does NOT change RLS on any existing sports/private table.
BEGIN;

CREATE TABLE public.family_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('training', 'objective', 'match_reflection')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  public_content text NOT NULL CHECK (char_length(btrim(public_content)) BETWEEN 1 AND 4000),
  reference_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_publications_publication_state_check
    CHECK ((status = 'published') = (published_at IS NOT NULL))
);

CREATE INDEX family_publications_public_feed_idx
  ON public.family_publications (reference_date DESC, created_at DESC)
  WHERE status = 'published';
CREATE INDEX family_publications_organization_idx
  ON public.family_publications (organization_id, reference_date DESC);

-- Keep ownership immutable and timestamps maintained server-side.
CREATE FUNCTION private.touch_family_publication_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Publication ownership and creation time cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.touch_family_publication_updated_at()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER touch_family_publications_updated_at
BEFORE UPDATE ON public.family_publications
FOR EACH ROW EXECUTE FUNCTION private.touch_family_publication_updated_at();

ALTER TABLE public.family_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_publications FROM PUBLIC, anon, authenticated;

-- The public feed must not expose ownership identifiers or author IDs.
-- Authenticated users retain full SELECT to support the existing admin editor.
GRANT SELECT (id, content_type, title, public_content, reference_date,
              status, published_at, created_at, updated_at)
  ON public.family_publications TO anon;
GRANT SELECT ON public.family_publications TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.family_publications TO authenticated;

-- Published records are intentionally public, regardless of originating organization.
CREATE POLICY family_publications_published_read
ON public.family_publications FOR SELECT TO anon, authenticated
USING (status = 'published');

-- Only active organization admins, as determined by the existing private.is_admin
-- helper, can access drafts or manage their organization's publications.
CREATE POLICY family_publications_admin_read
ON public.family_publications FOR SELECT TO authenticated
USING (private.is_admin(organization_id));

CREATE POLICY family_publications_admin_insert
ON public.family_publications FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND private.is_admin(organization_id)
  AND created_by = auth.uid()
);

CREATE POLICY family_publications_admin_update
ON public.family_publications FOR UPDATE TO authenticated
USING (private.is_admin(organization_id))
WITH CHECK (
  private.is_admin(organization_id)
  AND created_by IS NOT NULL
);

CREATE POLICY family_publications_admin_delete
ON public.family_publications FOR DELETE TO authenticated
USING (private.is_admin(organization_id));

COMMIT;
ed_at is not null))
);
create index family_publications_public_feed_idx
  on public.family_publications (reference_date desc, created_at desc)
  where status = 'published';
create index family_publications_organization_idx
  on public.family_publications (organization_id, reference_date desc);

create or replace function private.touch_family_publication_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.created_by is distinct from old.created_by then
    raise exception 'Publication ownership cannot be changed' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
alter function private.touch_family_publication_updated_at() owner to postgres;
revoke all on function private.touch_family_publication_updated_at() from public, anon, authenticated;
create trigger touch_family_publications_updated_at
before update on public.family_publications
for each row execute function private.touch_family_publication_updated_at();

alter table public.family_publications enable row level security;
revoke all on public.family_publications from public, anon, authenticated;
grant select on public.family_publications to anon, authenticated;
grant insert, update, delete on public.family_publications to authenticated;

-- Visitors and signed-in non-admins (including demo_viewer) can read only
-- already published, self-contained family content.
create policy family_publications_published_read
on public.family_publications for select to anon, authenticated
using (status = 'published');

-- Organization admins can manage their own drafts and publications. The
-- insert check binds created_by to the authenticated administrator.
create policy family_publications_admin_read
on public.family_publications for select to authenticated
using (private.is_admin(organization_id));
create policy family_publications_admin_insert
on public.family_publications for insert to authenticated
with check (private.is_admin(organization_id) and created_by = auth.uid());
create policy family_publications_admin_update
on public.family_publications for update to authenticated
using (private.is_admin(organization_id))
with check (private.is_admin(organization_id));
create policy family_publications_admin_delete
on public.family_publications for delete to authenticated
using (private.is_admin(organization_id));

commit;
