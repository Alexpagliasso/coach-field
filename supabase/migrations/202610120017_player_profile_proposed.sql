-- GrowPitch 017: profilo giocatore, note e obiettivi (revisione conservativa).
-- Eseguire MANUALMENTE in Supabase SQL Editor, dopo aver verificato i prerequisiti.
-- NON modifica dati esistenti e NON reintroduce IndexedDB.
BEGIN;

-- Preflight: non creare policy basate su helper inesistenti o colonne non presenti.
DO $$
BEGIN
  IF to_regprocedure('private.can_read_player(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Prerequisito mancante: private.can_read_player(uuid)';
  END IF;
  IF to_regprocedure('private.can_update_player(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Prerequisito mancante: private.can_update_player(uuid). Verificare il modello permessi prima di applicare 017.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'players' AND column_name = 'organization_id'
  ) THEN
    RAISE EXCEPTION 'Prerequisito mancante: public.players.organization_id';
  END IF;
END $$;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS preferred_role text,
  ADD COLUMN IF NOT EXISTS technical_rating numeric(2,1);

-- Constraint espliciti e nominati, ri-eseguibili.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.players'::regclass AND conname='players_preferred_role_valid_017') THEN
    ALTER TABLE public.players ADD CONSTRAINT players_preferred_role_valid_017
      CHECK (preferred_role IS NULL OR char_length(btrim(preferred_role)) BETWEEN 1 AND 80);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.players'::regclass AND conname='players_technical_rating_valid_017') THEN
    ALTER TABLE public.players ADD CONSTRAINT players_technical_rating_valid_017
      CHECK (technical_rating IS NULL OR (technical_rating BETWEEN 1 AND 5 AND technical_rating * 2 = trunc(technical_rating * 2)));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.player_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  context_type text NOT NULL DEFAULT 'general' CHECK (context_type IN ('general', 'training', 'match')),
  context_id uuid,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_notes_context_shape_017 CHECK (
    (context_type = 'general' AND context_id IS NULL)
    OR (context_type IN ('training','match') AND context_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.player_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 240),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_notes_player_created_idx ON public.player_notes(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS player_objectives_player_status_idx ON public.player_objectives(player_id, status, updated_at DESC);

-- Validazione server-side della relazione giocatore/societa', identita' autore e immutabilita'.
-- SECURITY DEFINER serve soltanto a leggere l'organizzazione del giocatore;
-- le policy RLS continuano a determinare chi puo' scrivere.
CREATE OR REPLACE FUNCTION public.player_profile_validate_row_017()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actual_org uuid;
BEGIN
  SELECT p.organization_id INTO actual_org FROM public.players AS p WHERE p.id = NEW.player_id;
  IF actual_org IS NULL OR actual_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Organizzazione non coerente con il giocatore' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL OR NEW.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Autore non valido' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.player_id IS DISTINCT FROM OLD.player_id
       OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Identita e autore del record non modificabili' USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.player_profile_validate_row_017() FROM PUBLIC;
DROP TRIGGER IF EXISTS player_notes_validate_017 ON public.player_notes;
CREATE TRIGGER player_notes_validate_017 BEFORE INSERT OR UPDATE ON public.player_notes
FOR EACH ROW EXECUTE FUNCTION public.player_profile_validate_row_017();
DROP TRIGGER IF EXISTS player_objectives_validate_017 ON public.player_objectives;
CREATE TRIGGER player_objectives_validate_017 BEFORE INSERT OR UPDATE ON public.player_objectives
FOR EACH ROW EXECUTE FUNCTION public.player_profile_validate_row_017();

ALTER TABLE public.player_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_objectives ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_notes, public.player_objectives TO authenticated;

DROP POLICY IF EXISTS player_notes_read ON public.player_notes;
DROP POLICY IF EXISTS player_notes_write ON public.player_notes;
DROP POLICY IF EXISTS player_objectives_read ON public.player_objectives;
DROP POLICY IF EXISTS player_objectives_write ON public.player_objectives;

CREATE POLICY player_notes_read ON public.player_notes FOR SELECT TO authenticated
  USING (private.can_read_player(player_id));
CREATE POLICY player_notes_write ON public.player_notes FOR ALL TO authenticated
  USING (private.can_update_player(player_id))
  WITH CHECK (private.can_update_player(player_id));
CREATE POLICY player_objectives_read ON public.player_objectives FOR SELECT TO authenticated
  USING (private.can_read_player(player_id));
CREATE POLICY player_objectives_write ON public.player_objectives FOR ALL TO authenticated
  USING (private.can_update_player(player_id))
  WITH CHECK (private.can_update_player(player_id));

COMMIT;

-- LIMITI DA VERIFICARE PRIMA DI USARE LE FUNZIONALITA':
-- 1. Le policy UPDATE gia' esistenti su public.players devono consentire al ruolo
--    desiderato di aggiornare preferred_role e technical_rating.
-- 2. context_id non ha FK polimorfica: l'esistenza/appartenenza della seduta/partita
--    va verificata lato server con lo schema effettivo prima di abilitare tali contesti.
-- 3. progress registra lo stato corrente, non una cronologia delle variazioni.
-- 4. Il trigger limita la modifica di autore/identita' ma NON limita chi puo' leggere
--    note private oltre alla policy can_read_player: confermare che sia la scelta voluta.
