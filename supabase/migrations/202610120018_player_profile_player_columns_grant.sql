-- HOTFIX PROPOSTO: applicare manualmente dopo 017.
-- La policy player_update resta restrittiva tramite private.can_update_player;
-- questo grant aggiunge esclusivamente le due colonne introdotte da 017.
begin;
grant update (preferred_role, technical_rating) on public.players to authenticated;
commit;
