-- GP-MD-03: auditable undo for the latest live substitution.
begin;

create function public.undo_last_match_live_substitution(p_match_id uuid, p_request_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  target public.matches%rowtype;
  state public.match_live_states%rowtype;
  original public.match_live_events%rowtype;
  elapsed integer;
  previous_slot text;
begin
  target:=private.match_live_authorize(p_match_id,true);
  if private.match_live_request_replayed(target.id,p_request_id,'undo_substitution') then return; end if;
  select * into state from public.match_live_states where match_id=target.id for update;
  if not found or state.phase not in ('running','paused') then raise exception 'A substitution can only be undone during a running or paused period' using errcode='22023'; end if;
  select * into original from public.match_live_events e
  where e.match_id=target.id and e.event_type='substitution' and e.period_number=state.current_period
    and e.metadata->>'operation'='substitution'
    and not exists(select 1 from public.match_live_events correction where correction.corrects_event_id=e.id and correction.metadata->>'operation'='undo_substitution')
  order by e.created_at desc,e.id desc limit 1 for update;
  if not found then raise exception 'No substitution is available to undo' using errcode='P0002'; end if;
  select slot_id into previous_slot from public.match_live_active_players where match_id=target.id and player_id=original.player_in_id for update;
  if previous_slot is null or exists(select 1 from public.match_live_active_players where match_id=target.id and player_id=original.player_out_id) then raise exception 'The latest substitution is no longer reversible' using errcode='40001'; end if;
  elapsed:=private.match_live_elapsed(state);
  update public.match_player_stints set exited_elapsed_seconds=elapsed
  where match_id=target.id and player_id=original.player_in_id and period_number=state.current_period and exited_elapsed_seconds is null;
  insert into public.match_player_stints(match_id,player_id,period_number,entered_elapsed_seconds)
  values(target.id,original.player_out_id,state.current_period,elapsed);
  delete from public.match_live_active_players where match_id=target.id and player_id=original.player_in_id;
  insert into public.match_live_active_players(match_id,player_id,slot_id) values(target.id,original.player_out_id,previous_slot);
  insert into public.match_live_events(match_id,request_id,event_type,period_number,elapsed_seconds,player_out_id,player_in_id,corrects_event_id,metadata)
  values(target.id,p_request_id,'substitution',state.current_period,elapsed,original.player_in_id,original.player_out_id,original.id,jsonb_build_object('operation','undo_substitution'));
  update public.match_live_states set version=version+1,updated_at=now() where match_id=target.id;
end $$;

create function public.get_last_undoable_match_substitution(p_match_id uuid)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare target public.matches%rowtype; state public.match_live_states%rowtype; event_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into target from public.matches where id=p_match_id;
  if not found or not private.has_match_permission(target.group_id,'matches.view') then raise exception 'Permission denied or match not found' using errcode='42501'; end if;
  select * into state from public.match_live_states where match_id=target.id;
  if not found or state.phase not in ('running','paused') then return null; end if;
  select e.id into event_id from public.match_live_events e
  where e.match_id=target.id and e.event_type='substitution' and e.period_number=state.current_period and e.metadata->>'operation'='substitution'
    and not exists(select 1 from public.match_live_events correction where correction.corrects_event_id=e.id and correction.metadata->>'operation'='undo_substitution')
  order by e.created_at desc,e.id desc limit 1;
  return event_id;
end $$;

alter function public.undo_last_match_live_substitution(uuid,uuid) owner to postgres;
alter function public.get_last_undoable_match_substitution(uuid) owner to postgres;
revoke all on function public.undo_last_match_live_substitution(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_last_undoable_match_substitution(uuid) from public,anon,authenticated;
grant execute on function public.undo_last_match_live_substitution(uuid,uuid) to authenticated;
grant execute on function public.get_last_undoable_match_substitution(uuid) to authenticated;
commit;
