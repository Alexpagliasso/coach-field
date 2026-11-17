-- GP-NOTIF-01A: queue one backend email per active collaborator when a
-- training session or match is first made visible. No provider is called here.
begin;

create table public.email_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('training_session_published','match_published')),
  aggregate_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null check (char_length(btrim(recipient_email)) > 0),
  author_user_id uuid not null references public.profiles(id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, aggregate_id, recipient_user_id)
);

create index email_notification_outbox_pending_idx
  on public.email_notification_outbox (available_at, created_at)
  where status in ('pending','failed');

alter table public.email_notification_outbox enable row level security;
revoke all on public.email_notification_outbox from public, anon, authenticated;
grant select, update, delete on public.email_notification_outbox to service_role;

create function private.queue_first_publication_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  should_queue boolean := false;
  notification_type text;
  notification_payload jsonb;
begin
  if tg_table_name = 'training_sessions' then
    if tg_op = 'INSERT' then
      should_queue := not new.is_hidden;
    else
      should_queue := old.is_hidden and not new.is_hidden;
    end if;
    notification_type := 'training_session_published';
    notification_payload := jsonb_build_object(
      'trainingSessionId', new.id,
      'title', new.title,
      'date', new.session_date,
      'startTime', new.start_time,
      'status', new.status,
      'groupId', new.group_id
    );
  elsif tg_table_name = 'matches' then
    if tg_op = 'INSERT' then
      should_queue := not new.is_hidden and new.status <> 'cancelled';
    else
      should_queue := not new.is_hidden and new.status <> 'cancelled'
        and (old.is_hidden or old.status = 'cancelled');
    end if;
    notification_type := 'match_published';
    notification_payload := jsonb_build_object(
      'matchId', new.id,
      'opponent', new.opponent,
      'date', new.match_date,
      'startTime', new.start_time,
      'status', new.status,
      'groupId', new.group_id
    );
  end if;

  if not should_queue then return new; end if;

  insert into public.email_notification_outbox (
    event_type, aggregate_id, organization_id, group_id,
    recipient_user_id, recipient_email, author_user_id, payload
  )
  select
    notification_type, new.id, new.organization_id, new.group_id,
    membership.user_id, profile.email, new.created_by, notification_payload
  from public.group_memberships membership
  join public.profiles profile on profile.id = membership.user_id
  where membership.group_id = new.group_id
    and membership.organization_id = new.organization_id
    and membership.active
    and membership.role = 'collaborator'
    and membership.user_id <> new.created_by
    and char_length(btrim(profile.email)) > 0
    and coalesce((
      select permission.enabled
      from public.collaborator_permissions permission
      where permission.membership_id = membership.id
        and permission.permission = case
          when notification_type = 'training_session_published' then 'training.view'
          else 'matches.view'
        end
    ), true)
  on conflict (event_type, aggregate_id, recipient_user_id) do nothing;

  return new;
end;
$$;

alter function private.queue_first_publication_emails() owner to postgres;
revoke all on function private.queue_first_publication_emails() from public, anon, authenticated;

create trigger queue_training_session_first_publication_email
after insert or update of is_hidden on public.training_sessions
for each row execute function private.queue_first_publication_emails();

create trigger queue_match_first_publication_email
after insert or update of is_hidden, status on public.matches
for each row execute function private.queue_first_publication_emails();

commit;
