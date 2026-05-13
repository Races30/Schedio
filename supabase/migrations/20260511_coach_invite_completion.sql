-- Coach invite flow completion + session notifications
-- Adds invited_at, accepted_at; public anon invite lookup; session notification triggers

-- ── 1. Add missing invite tracking columns ──────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS invited_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- ── 2. Public RLS: allow anon to read a client row by invite_token ───────────
CREATE OR REPLACE VIEW public.client_invite_lookup AS
  SELECT id, name, email, invite_accepted
  FROM public.clients
  WHERE invite_token IS NOT NULL;

GRANT SELECT ON public.client_invite_lookup TO anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'clients_public_invite_lookup'
  ) THEN
    CREATE POLICY "clients_public_invite_lookup" ON public.clients
      FOR SELECT TO anon
      USING (invite_token IS NOT NULL);
  END IF;
END $$;

-- ── 3. Add notification types for coach session events ──────────────────────
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'session_created';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'session_confirmed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'session_rescheduled';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'invite_accepted';

-- ── 4. Trigger: notify trainer when a session is created, confirmed, or rescheduled
CREATE OR REPLACE FUNCTION public.handle_session_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name  TEXT;
  v_client_email TEXT;
BEGIN
  SELECT c.name, c.email
    INTO v_client_name, v_client_email
  FROM public.clients c
  WHERE c.id = COALESCE(NEW.client_id, OLD.client_id);

  -- INSERT: new session created → notify trainer (internal)
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE type = 'session_created' AND message ILIKE '%' || NEW.id::text || '%'
    ) THEN
      INSERT INTO public.notifications (activity_id, client_id, type, channel, title, message)
      VALUES (
        NEW.activity_id, NEW.client_id, 'session_created', 'internal',
        'Nuova sessione creata',
        'È stata creata una sessione per ' || COALESCE(v_client_name, 'il cliente') ||
          CASE WHEN NEW.scheduled_at IS NOT NULL
            THEN ' il ' || to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY HH24:MI')
            ELSE '' END ||
          ' [session:' || NEW.id::text || ']'
      );
    END IF;
  END IF;

  -- UPDATE: status changed to confermata
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'confermata' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE type = 'session_confirmed' AND message ILIKE '%' || NEW.id::text || '%'
        AND created_at > NOW() - INTERVAL '5 minutes'
    ) THEN
      INSERT INTO public.notifications (activity_id, client_id, type, channel, title, message)
      VALUES (
        NEW.activity_id, NEW.client_id, 'session_confirmed', 'internal',
        'Sessione confermata',
        COALESCE(v_client_name, 'Il cliente') || ' ha confermato la sessione del ' ||
          CASE WHEN NEW.scheduled_at IS NOT NULL
            THEN to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY HH24:MI')
            ELSE '(data da definire)' END ||
          ' [session:' || NEW.id::text || ']'
      );
    END IF;

    -- Reminder email to client 24h before
    IF NEW.scheduled_at IS NOT NULL AND NEW.scheduled_at > NOW() + INTERVAL '24 hours'
      AND v_client_email IS NOT NULL THEN
      INSERT INTO public.notifications (activity_id, client_id, type, channel, title, message, scheduled_for)
      VALUES (
        NEW.activity_id, NEW.client_id, 'reminder_24h', 'email',
        'Promemoria sessione domani',
        'Ricordati della tua sessione di allenamento domani alle ' ||
          to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Rome', 'HH24:MI') || '.',
        NEW.scheduled_at - INTERVAL '24 hours'
      );
    END IF;
  END IF;

  -- UPDATE: scheduled_at changed (reschedule)
  IF TG_OP = 'UPDATE'
    AND OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at
    AND NEW.scheduled_at IS NOT NULL AND OLD.scheduled_at IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE type = 'session_rescheduled' AND message ILIKE '%' || NEW.id::text || '%'
        AND created_at > NOW() - INTERVAL '5 minutes'
    ) THEN
      INSERT INTO public.notifications (activity_id, client_id, type, channel, title, message)
      VALUES (
        NEW.activity_id, NEW.client_id, 'session_rescheduled', 'internal',
        'Sessione spostata',
        COALESCE(v_client_name, 'Il cliente') || ' ha spostato la sessione al ' ||
          to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Rome', 'DD/MM/YYYY HH24:MI') ||
          ' [session:' || NEW.id::text || ']'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_session_notifications ON public.sessions;
CREATE TRIGGER trigger_session_notifications
  AFTER INSERT OR UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_session_notifications();

-- ── 5. Index for invite_token lookup ────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_invite_token
  ON public.clients(invite_token)
  WHERE invite_token IS NOT NULL;
