
-- GrowPitch: organization-scoped technical objective tags.
-- Replaces the previous, unapplied migration 020.
-- Prerequisites: public.organizations, public.profiles,
-- public.groups, public.training_sessions and
-- private.has_training_permission(uuid, text).
--
-- Catalog management: database administrator only for now.
-- Authorized coaches can assign existing tags to their sessions.
-- Existing free-text training objectives remain untouched.

begin;

create table if not exists public.training_objective_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  name text not null
    check (char_length(btrim(name)) between 1 and 80),
  slug text not null
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  created_by uuid
    references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists
  training_objective_tags_org_name_idx
on public.training_objective_tags (organization_id, name);

create table if not exists
  public.training_session_objective_tags (
    training_session_id uuid not null
      references public.training_sessions(id) on delete cascade,
    objective_tag_id uuid not null
      references public.training_objective_tags(id)
      on delete restrict,
    created_at timestamptz not null default now(),
    primary key (training_session_id, objective_tag_id)
  );

create index if not exists
  training_session_objective_tags_tag_idx
on public.training_session_objective_tags (
  objective_tag_id, training_session_id
);

-- Ensure a session cannot reference a tag from another organization.
create or replace function
  private.validate_training_session_objective_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_org uuid;
  tag_org uuid;
begin
  select s.organization_id
    into session_org
  from public.training_sessions s
  where s.id = new.training_session_id;

  select t.organization_id
    into tag_org
  from public.training_objective_tags t
  where t.id = new.objective_tag_id;

  if session_org is null
     or tag_org is null
     or session_org <> tag_org then
    raise exception
      'Objective tag and training session must belong to the same organization'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

revoke all on function
  private.validate_training_session_objective_tag()
from public, anon, authenticated;

drop trigger if exists
  validate_training_session_objective_tag
on public.training_session_objective_tags;

create trigger validate_training_session_objective_tag
before insert or update
on public.training_session_objective_tags
for each row
execute function
  private.validate_training_session_objective_tag();

-- Row-level security.
alter table public.training_objective_tags
  enable row level security;

alter table public.training_session_objective_tags
  enable row level security;

-- Catalog is read-only from the application.
revoke all on public.training_objective_tags
  from anon, authenticated;

grant select on public.training_objective_tags
  to authenticated;

-- Session associations are readable directly.
-- Writes must go through the controlled RPC.
revoke all on public.training_session_objective_tags
  from anon, authenticated;

grant select on public.training_session_objective_tags
  to authenticated;

drop policy if exists training_objective_tag_read
on public.training_objective_tags;

create policy training_objective_tag_read
on public.training_objective_tags
for select to authenticated
using (
  exists (
    select 1
    from public.groups g
    where g.organization_id =
      training_objective_tags.organization_id
      and private.has_training_permission(
        g.id, 'training.view'
      )
  )
);

drop policy if exists training_session_objective_tag_read
on public.training_session_objective_tags;

create policy training_session_objective_tag_read
on public.training_session_objective_tags
for select to authenticated
using (
  exists (
    select 1
    from public.training_sessions s
    where s.id = training_session_id
      and private.has_training_permission(
        s.group_id, 'training.view'
      )
  )
);

-- Remove policies from the earlier draft, if present.
drop policy if exists training_objective_tag_write
on public.training_objective_tags;

drop policy if exists training_session_objective_tag_write
on public.training_session_objective_tags;

-- Atomic assignment of tags to an authorized training session.
create or replace function
  public.set_training_session_objective_tags(
    p_session_id uuid,
    p_tag_ids uuid[]
  )
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.training_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  select *
    into target
  from public.training_sessions
  where id = p_session_id
  for update;

  if not found
     or not private.has_training_permission(
       target.group_id, 'training.edit'
     ) then
    raise exception
      'Permission denied or session not found'
      using errcode = '42501';
  end if;

  -- Validate all submitted tags before changing anything.
  if exists (
    select 1
    from unnest(
      coalesce(p_tag_ids, '{}'::uuid[])
    ) as submitted(id)
    left join public.training_objective_tags t
      on t.id = submitted.id
    where t.id is null
       or t.organization_id <> target.organization_id
       or not t.is_active
  ) then
    raise exception
      'Invalid, inactive or cross-organization objective tag'
      using errcode = '23503';
  end if;

  delete from public.training_session_objective_tags
  where training_session_id = target.id;

  insert into public.training_session_objective_tags (
    training_session_id,
    objective_tag_id
  )
  select target.id, submitted.id
  from (
    select distinct unnest(
      coalesce(p_tag_ids, '{}'::uuid[])
    ) as id
  ) submitted;
end;
$$;

revoke all on function
  public.set_training_session_objective_tags(uuid, uuid[])
from public, anon, authenticated;

grant execute on function
  public.set_training_session_objective_tags(uuid, uuid[])
to authenticated;

commit;
