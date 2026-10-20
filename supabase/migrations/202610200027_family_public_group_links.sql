-- Public family diary links scoped to one WorkGroup.
-- Apply manually after migrations 025 and 026.
begin;

-- The function resolves the owning organization internally. Anonymous callers
-- never receive group or organization rows: only already-published family text
-- for the requested WorkGroup and that organization's general publications.
create or replace function public.get_family_publications_for_group(
  p_group_id uuid,
  p_content_types text[] default null,
  p_from date default null,
  p_to date default null,
  p_search text default null,
  p_limit integer default 13,
  p_offset integer default 0
)
returns table (
  content_type text,
  title text,
  public_content text,
  reference_date date,
  published_at timestamptz,
  group_id uuid
)
language sql stable security definer set search_path = '' as $$
  with target_group as (
    select g.organization_id from public.groups g where g.id = p_group_id
  )
  select f.content_type, f.title, f.public_content, f.reference_date,
         f.published_at, f.group_id
  from public.family_publications f
  join target_group target on target.organization_id = f.organization_id
  where f.status = 'published'
    and (f.group_id = p_group_id or f.group_id is null)
    and (p_content_types is null or f.content_type = any(p_content_types))
    and (p_from is null or f.reference_date >= p_from)
    and (p_to is null or f.reference_date < p_to)
    and (p_search is null or f.title ilike '%' || p_search || '%' or f.public_content ilike '%' || p_search || '%')
  order by f.reference_date desc, f.published_at desc
  limit greatest(1, least(coalesce(p_limit, 13), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;
alter function public.get_family_publications_for_group(uuid, text[], date, date, text, integer, integer) owner to postgres;
revoke all on function public.get_family_publications_for_group(uuid, text[], date, date, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_family_publications_for_group(uuid, text[], date, date, text, integer, integer) to anon, authenticated;

commit;
