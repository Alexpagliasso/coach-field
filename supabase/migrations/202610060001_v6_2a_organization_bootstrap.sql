begin;

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
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if normalized_name is null or normalized_name = '' then
    raise exception 'Organization name is required' using errcode = '22023';
  end if;

  if char_length(normalized_name) > 120 then
    raise exception 'Organization name must be 120 characters or fewer' using errcode = '22023';
  end if;

  slug_base := trim(both '-' from lower(regexp_replace(normalized_name, '[^a-zA-Z0-9]+', '-', 'g')));
  if slug_base = '' then
    slug_base := 'organization';
  end if;
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

commit;
