-- GP-NOTIF-01B: atomic claiming and retry lifecycle for the email worker.
begin;

alter table public.email_notification_outbox
  add column provider_message_id text,
  add column locked_at timestamptz;

create function public.claim_email_notification_batch(p_limit integer default 20)
returns setof public.email_notification_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.email_notification_outbox
  set status = 'failed', locked_at = null, updated_at = now(),
      last_error = coalesce(last_error, 'Processing lease expired')
  where status = 'processing' and locked_at < now() - interval '10 minutes';

  return query
  with candidates as (
    select queue.id
    from public.email_notification_outbox queue
    where queue.status in ('pending','failed')
      and queue.available_at <= now()
      and queue.attempt_count < 8
    order by queue.available_at, queue.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,20),100))
  )
  update public.email_notification_outbox queue
  set status = 'processing', locked_at = now(),
      attempt_count = queue.attempt_count + 1, updated_at = now(), last_error = null
  from candidates
  where queue.id = candidates.id
  returning queue.*;
end;
$$;

create function public.mark_email_notification_sent(p_id uuid, p_provider_message_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.email_notification_outbox
  set status='sent', provider_message_id=p_provider_message_id,
      processed_at=now(), locked_at=null, updated_at=now(), last_error=null
  where id=p_id and status='processing';
$$;

create function public.mark_email_notification_failed(p_id uuid, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.email_notification_outbox
  set status='failed', locked_at=null, updated_at=now(),
      last_error=left(coalesce(p_error,'Unknown email error'),2000),
      available_at=now()+make_interval(secs=>least(3600,(30*power(2,greatest(attempt_count-1,0)))::integer))
  where id=p_id and status='processing';
$$;

alter function public.claim_email_notification_batch(integer) owner to postgres;
alter function public.mark_email_notification_sent(uuid,text) owner to postgres;
alter function public.mark_email_notification_failed(uuid,text) owner to postgres;
revoke all on function public.claim_email_notification_batch(integer), public.mark_email_notification_sent(uuid,text), public.mark_email_notification_failed(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_email_notification_batch(integer), public.mark_email_notification_sent(uuid,text), public.mark_email_notification_failed(uuid,text) to service_role;

commit;
