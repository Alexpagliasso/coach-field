-- Field mode notes: apply manually after migration 014.
begin;

create table public.training_session_field_notes (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid not null references public.training_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  exercise_position integer check (exercise_position is null or exercise_position > 0),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_session_field_notes_session_idx on public.training_session_field_notes(training_session_id, created_at desc);

create or replace function private.validate_training_session_field_note()
returns trigger language plpgsql security definer set search_path = '' as $$
declare session_org uuid;
begin
  select organization_id into session_org from public.training_sessions where id = new.training_session_id;
  if session_org is null or new.organization_id <> session_org then
    raise exception 'Field note and training session must belong to the same organization' using errcode = '23503';
  end if;
  if new.created_by <> auth.uid() then
    raise exception 'Field note creator must be the authenticated user' using errcode = '42501';
  end if;
  return new;-- GrowPitch
-- 202610160021_training_session_field_notes.sql
-- Applicare dopo le migration che creano training_sessions,
-- profiles e private.has_training_permission().

begin;

create table public.training_session_field_notes (
  id uuid primary key default gen_random_uuid(),

  training_session_id uuid not null
    references public.training_sessions(id)
    on delete cascade,

  organization_id uuid not null
    references public.organizations(id)
    on delete restrict,

  exercise_position integer
    check (exercise_position is null or exercise_position > 0),

  body text not null
    check (char_length(btrim(body)) between 1 and 4000),

  created_by uuid not null
    default auth.uid()
    references public.profiles(id)
    on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indici

create index training_session_field_notes_session_idx
  on public.training_session_field_notes (
    training_session_id,
    created_at desc
  );

-- Validazione organizzazione e autore

create or replace function private.validate_training_session_field_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_org uuid;
begin
  select s.organization_id
  into session_org
  from public.training_sessions s
  where s.id = new.training_session_id;

  if session_org is null
     or new.organization_id <> session_org then
    raise exception
      'Field note and training session must belong to the same organization'
      using errcode = '23503';
  end if;

  if new.created_by is distinct from auth.uid() then
    raise exception
      'Field note creator must be the authenticated user'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

alter function private.validate_training_session_field_note()
  owner to postgres;

revoke all on function private.validate_training_session_field_note()
  from public, anon, authenticated;

create trigger validate_training_session_field_note
before insert or update of
  training_session_id,
  organization_id,
  created_by
on public.training_session_field_notes
for each row
execute function private.validate_training_session_field_note();

-- Aggiornamento automatico updated_at

create or replace function private.touch_training_session_field_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_training_session_field_note
before update on public.training_session_field_notes
for each row
execute function private.touch_training_session_field_note();

-- Row Level Security

alter table public.training_session_field_notes
  enable row level security;

grant select, insert, update, delete
  on public.training_session_field_notes
  to authenticated;

-- Lettura: utenti autorizzati a visualizzare la seduta

create policy training_field_note_read
on public.training_session_field_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.training_sessions s
    where s.id = training_session_id
      and private.has_training_permission(
        s.group_id,
        'training.view'
      )
  )
);

-- Creazione: utenti con permesso training.edit

create policy training_field_note_insert
on public.training_session_field_notes
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.training_sessions s
    where s.id = training_session_id
      and private.has_training_permission(
        s.group_id,
        'training.edit'
      )
  )
);

-- Modifica: soltanto l'autore, se ancora autorizzato

create policy training_field_note_update
on public.training_session_field_notes
for update
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.training_sessions s
    where s.id = training_session_id
      and private.has_training_permission(
        s.group_id,
        'training.edit'
      )
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.training_sessions s
    where s.id = training_session_id
      and private.has_training_permission(
        s.group_id,
        'training.edit'
      )
  )
);

-- Eliminazione: soltanto l'autore

create policy training_field_note_delete
on public.training_session_field_notes
for delete
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1
    from public.training_sessions s
    where s.id = training_session_id
      and private.has_training_permission(
        s.group_id,
        'training.edit'
      )
  )
);

commit;
end;
$$;
alter function private.validate_training_session_field_note() owner to postgres;
revoke all on function private.validate_training_session_field_note() from public, anon, authenticated;
create trigger validate_training_session_field_note before insert or update of training_session_id, organization_id, created_by on public.training_session_field_notes for each row execute function private.validate_training_session_field_note();

alter table public.training_session_field_notes enable row level security;
grant select, insert, update, delete on public.training_session_field_notes to authenticated;
create policy training_field_note_read on public.training_session_field_notes for select to authenticated using (exists (select 1 from public.training_sessions s where s.id = training_session_id and private.has_training_permission(s.group_id, 'training.view')));
create policy training_field_note_write on public.training_session_field_notes for all to authenticated using (exists (select 1 from public.training_sessions s where s.id = training_session_id and private.has_training_permission(s.group_id, 'training.edit'))) with check (exists (select 1 from public.training_sessions s where s.id = training_session_id and private.has_training_permission(s.group_id, 'training.edit')));

commit;
