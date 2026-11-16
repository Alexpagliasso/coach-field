-- GP-FAM-01: stable, readable public family routes per WorkGroup.
begin;

create table public.family_public_group_routes (
  group_id uuid primary key references public.groups(id) on delete restrict,
  season_slug text not null check (season_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category_slug text not null check (category_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  group_slug text not null check (group_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  updated_at timestamptz not null default now(),
  unique (season_slug,category_slug,group_slug)
);

alter table public.family_public_group_routes enable row level security;
revoke all on public.family_public_group_routes from public,anon,authenticated;

create function private.family_slug(value text)
returns text language sql immutable strict set search_path='' as $$
  select trim(both '-' from regexp_replace(lower(translate(value,'àáâäèéêëìíîïòóôöùúûüç','aaaaeeeeiiiioooouuuuc')),'[^a-z0-9]+','-','g'))
$$;
alter function private.family_slug(text) owner to postgres;
revoke all on function private.family_slug(text) from public,anon,authenticated;

-- Existing group-scoped publications are already unambiguous. Create routes
-- only where the modern WorkGroup -> category -> season hierarchy is complete.
with candidates as (
  select g.id group_id,private.family_slug(s.name) season_slug,private.family_slug(t.name) category_slug,private.family_slug(g.name) base_slug,
    row_number() over(partition by private.family_slug(s.name),private.family_slug(t.name),private.family_slug(g.name) order by g.id) collision
  from public.groups g join public.teams t on t.id=g.team_id join public.organization_seasons s on s.id=t.season_id
  where private.family_slug(s.name)<>'' and private.family_slug(t.name)<>'' and private.family_slug(g.name)<>''
)
insert into public.family_public_group_routes(group_id,season_slug,category_slug,group_slug)
select group_id,season_slug,category_slug,case when collision=1 then base_slug else base_slug||'-'||left(replace(group_id::text,'-',''),8) end from candidates
on conflict(group_id) do nothing;

create function public.ensure_family_public_route(p_group_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare season_part text; category_part text; group_part text; final_group text;
begin
  select private.family_slug(s.name),private.family_slug(t.name),private.family_slug(g.name)
  into season_part,category_part,group_part
  from public.groups g join public.teams t on t.id=g.team_id join public.organization_seasons s on s.id=t.season_id
  where g.id=p_group_id and private.is_admin(g.organization_id);
  if not found then raise exception 'Permission denied or incomplete WorkGroup hierarchy' using errcode='42501'; end if;
  if season_part='' or category_part='' or group_part='' then raise exception 'Public route requires season, category and group names' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(season_part||'/'||category_part||'/'||group_part,0));
  final_group:=group_part;
  if exists(select 1 from public.family_public_group_routes r where r.season_slug=season_part and r.category_slug=category_part and r.group_slug=final_group and r.group_id<>p_group_id) then
    final_group:=group_part||'-'||left(replace(p_group_id::text,'-',''),8);
  end if;
  insert into public.family_public_group_routes(group_id,season_slug,category_slug,group_slug,updated_at)
  values(p_group_id,season_part,category_part,final_group,now())
  on conflict(group_id) do update set season_slug=excluded.season_slug,category_slug=excluded.category_slug,group_slug=excluded.group_slug,updated_at=now();
  return '/'||season_part||'/'||category_part||'/'||final_group;
end $$;

create function public.get_family_public_route(p_group_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select '/'||r.season_slug||'/'||r.category_slug||'/'||r.group_slug from public.family_public_group_routes r where r.group_id=p_group_id
$$;

create function public.get_family_publications_for_path(
  p_season_slug text,p_category_slug text,p_group_slug text,p_content_types text[] default null,
  p_from date default null,p_to date default null,p_search text default null,p_limit integer default 13,p_offset integer default 0
)
returns table(content_type text,title text,public_content text,reference_date date,published_at timestamptz,group_id uuid)
language sql stable security definer set search_path='' as $$
  select f.content_type,f.title,f.public_content,f.reference_date,f.published_at,f.group_id
  from public.family_public_group_routes r join public.family_publications f on f.group_id=r.group_id
  where r.season_slug=p_season_slug and r.category_slug=p_category_slug and r.group_slug=p_group_slug and f.status='published'
    and (p_content_types is null or f.content_type=any(p_content_types)) and (p_from is null or f.reference_date>=p_from)
    and (p_to is null or f.reference_date<p_to) and (p_search is null or f.title ilike '%'||p_search||'%' or f.public_content ilike '%'||p_search||'%')
  order by f.reference_date desc,f.published_at desc limit greatest(1,least(coalesce(p_limit,13),100)) offset greatest(0,coalesce(p_offset,0))
$$;

alter function public.ensure_family_public_route(uuid) owner to postgres;
alter function public.get_family_public_route(uuid) owner to postgres;
alter function public.get_family_publications_for_path(text,text,text,text[],date,date,text,integer,integer) owner to postgres;
revoke all on function public.ensure_family_public_route(uuid),public.get_family_public_route(uuid),public.get_family_publications_for_path(text,text,text,text[],date,date,text,integer,integer) from public,anon,authenticated;
grant execute on function public.ensure_family_public_route(uuid) to authenticated;
grant execute on function public.get_family_public_route(uuid),public.get_family_publications_for_path(text,text,text,text[],date,date,text,integer,integer) to anon,authenticated;
commit;
