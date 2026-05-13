-- Session Negotiation System
-- Adds proposal/counter-proposal flow between trainer and client

-- 1. Extend sessions table with cancellation fields
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS cancelled_by  TEXT CHECK (cancelled_by IS NULL OR cancelled_by IN ('trainer', 'cliente')),
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ;

-- 2. Extend status check constraint to include 'controproposta' and 'annullata'
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_status_check
  CHECK (status = ANY (ARRAY[
    'proposta'::text,
    'controproposta'::text,
    'confermata'::text,
    'completata'::text,
    'rifiutata'::text,
    'annullata'::text
  ]));

-- 3. Immutable proposals log
CREATE TABLE IF NOT EXISTS public.session_proposals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  proposed_by  TEXT NOT NULL CHECK (proposed_by IN ('trainer', 'cliente')),
  proposed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.session_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer_manage_proposals" ON public.session_proposals
  FOR ALL TO authenticated
  USING (
    session_id IN (
      SELECT s.id FROM public.sessions s
      JOIN public.activities a ON a.id = s.activity_id
      WHERE a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT s.id FROM public.sessions s
      JOIN public.activities a ON a.id = s.activity_id
      WHERE a.user_id = auth.uid()
    )
  );

CREATE POLICY "client_manage_proposals" ON public.session_proposals
  FOR ALL TO authenticated
  USING (
    session_id IN (
      SELECT s.id FROM public.sessions s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT s.id FROM public.sessions s
      JOIN public.clients c ON c.id = s.client_id
      WHERE c.user_id = auth.uid()
    )
  );

-- 4. RLS extensions for sessions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sessions' AND policyname = 'client_view_own_sessions'
  ) THEN
    CREATE POLICY "client_view_own_sessions" ON public.sessions
      FOR SELECT TO authenticated
      USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sessions' AND policyname = 'client_insert_session_proposal'
  ) THEN
    CREATE POLICY "client_insert_session_proposal" ON public.sessions
      FOR INSERT TO authenticated
      WITH CHECK (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
        AND proposed_by = 'cliente'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sessions' AND policyname = 'client_update_own_session'
  ) THEN
    CREATE POLICY "client_update_own_session" ON public.sessions
      FOR UPDATE TO authenticated
      USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- 5. Performance indexes
CREATE INDEX IF NOT EXISTS idx_session_proposals_session_id ON public.session_proposals(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client_id_status    ON public.sessions(client_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_activity_id_status  ON public.sessions(activity_id, status);
