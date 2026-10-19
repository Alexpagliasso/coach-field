-- Manual RLS verification for GP-11A.
--
-- Run as a project administrator in a non-production SQL session. Replace
-- the placeholder with the UUID of the dedicated Demo Viewer profile. The
-- transaction always rolls back, including the deliberate write attempts.

begin;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-0000-0000-000000000000',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

-- Positive: exactly one organization is visible and it is the demo.
select id, name, slug
from public.organizations
order by slug;

-- Positive: all hierarchy rows belong to that same organization.
select s.name as season, t.name as category, g.name as workgroup
from public.organization_seasons s
join public.teams t on t.season_id = s.id and t.organization_id = s.organization_id
join public.groups g on g.team_id = t.id and g.organization_id = t.organization_id
order by s.name, t.name, g.name;

-- Positive: dashboard, training and match reads return demo data only.
select count(*) as demo_players from public.players;
select count(*) as demo_sessions from public.training_sessions;
select count(*) as demo_attendance_marks from public.training_session_attendance;
select count(*) as demo_matches from public.matches;
select count(*) as demo_live_events from public.match_live_events;

-- Negative: no non-demo organization may be visible.
do $$
begin
  if exists (select 1 from public.organizations where slug <> 'torino-nord-academy-demo') then
    raise exception 'FAIL: Demo Viewer can read a non-demo organization';
  end if;
end;
$$;

-- Negative: direct writes and write RPCs must be denied or affect no rows.
do $$
declare
  v_match_id uuid;
  v_changed uuid;
begin
  select id into v_match_id from public.matches limit 1;

  begin
    perform public.bootstrap_organization('Forbidden Demo Viewer Organization');
    raise exception 'FAIL: Demo Viewer created an organization';
  exception when insufficient_privilege then null;
  end;

  update public.matches
  set coach_notes = 'forbidden test write'
  where id = v_match_id
  returning id into v_changed;
  if v_changed is not null then
    raise exception 'FAIL: Demo Viewer updated a match';
  end if;

  begin
    perform public.start_match_live(v_match_id, gen_random_uuid());
    raise exception 'FAIL: Demo Viewer started Match Live';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.demo_viewer_access(user_id, organization_id)
    select auth.uid(), id from public.organizations limit 1;
    raise exception 'FAIL: Demo Viewer changed Demo Viewer access';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
