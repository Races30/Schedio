-- Coach Pro: Full schema additions
-- Adds specialization/location to activities, extends clients,
-- and creates sessions, workout_plans, workout_completions tables.

-- ── Activities ──────────────────────────────────────────────────────────────
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS specialization TEXT,
  ADD COLUMN IF NOT EXISTS location       TEXT;

-- ── Clients (extend existing table) ─────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS user_id               UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS surname               TEXT,
  ADD COLUMN IF NOT EXISTS age                   INTEGER,
  ADD COLUMN IF NOT EXISTS goal                  TEXT,
  ADD COLUMN IF NOT EXISTS target_area           TEXT
    CONSTRAINT clients_target_area_check CHECK (
      target_area IS NULL OR target_area IN ('upper','lower','full')
    ),
  ADD COLUMN IF NOT EXISTS target_muscles        JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS invite_token          TEXT,
  ADD COLUMN IF NOT EXISTS invite_sent           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invite_accepted       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trainer_private_notes TEXT;

-- Unique constraint so two clients can't share the same auth user
CREATE UNIQUE INDEX IF NOT EXISTS clients_user_id_unique
  ON clients(user_id) WHERE user_id IS NOT NULL;

-- ── Sessions ─────────────────────────────────────────────────────────────────
-- Manages the propose→confirm flow between trainer and client
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id   UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id)   ON DELETE CASCADE,
  scheduled_at  TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'proposta'
    CONSTRAINT sessions_status_check
      CHECK (status IN ('proposta','confermata','completata','rifiutata')),
  proposed_by   TEXT NOT NULL DEFAULT 'trainer'
    CONSTRAINT sessions_proposed_by_check
      CHECK (proposed_by IN ('trainer','cliente')),
  proposed_times JSONB NOT NULL DEFAULT '[]'::jsonb,
  confirmed_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Session exercises ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_exercises (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
  exercise_id   UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  planned_value NUMERIC,
  actual_value  NUMERIC,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Session feedback (dal cliente, post sessione) ─────────────────────────────
CREATE TABLE IF NOT EXISTS session_feedback (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES clients(id)   ON DELETE CASCADE,
  energy_level     INTEGER CONSTRAINT session_feedback_energy CHECK (energy_level BETWEEN 1 AND 5),
  was_tired        BOOLEAN,
  had_difficulty   BOOLEAN,
  difficulty_notes TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Workout plans (schede allenamento autonomo) ──────────────────────────────
CREATE TABLE IF NOT EXISTS workout_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id   UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id)   ON DELETE CASCADE,
  name          TEXT NOT NULL,
  -- exercises stored as [{exercise_id, exercise_name, sets, reps_or_secs, rest_secs, notes}]
  exercises     JSONB NOT NULL DEFAULT '[]'::jsonb,
  trainer_notes TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Workout completions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id)       ON DELETE CASCADE,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_activity   ON sessions(activity_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client     ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_workout_plans_client ON workout_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_workout_completions_client ON workout_completions(client_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_feedback  ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_completions ENABLE ROW LEVEL SECURITY;

-- Trainer manages own sessions
CREATE POLICY "sessions_trainer_all" ON sessions FOR ALL TO authenticated
  USING   (activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid()))
  WITH CHECK (activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid()));

-- Client can read their own sessions (for client dashboard)
CREATE POLICY "sessions_client_read" ON sessions FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Client can update (propose counter-times) on their own sessions
CREATE POLICY "sessions_client_update" ON sessions FOR UPDATE TO authenticated
  USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "session_exercises_trainer_all" ON session_exercises FOR ALL TO authenticated
  USING (session_id IN (
    SELECT id FROM sessions WHERE activity_id IN (
      SELECT id FROM activities WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "session_feedback_trainer_read" ON session_feedback FOR SELECT TO authenticated
  USING (session_id IN (
    SELECT id FROM sessions WHERE activity_id IN (
      SELECT id FROM activities WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "session_feedback_client_insert" ON session_feedback FOR INSERT TO authenticated
  WITH CHECK (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "workout_plans_trainer_all" ON workout_plans FOR ALL TO authenticated
  USING   (activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid()))
  WITH CHECK (activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid()));

CREATE POLICY "workout_plans_client_read" ON workout_plans FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "workout_completions_trainer_read" ON workout_completions FOR SELECT TO authenticated
  USING (workout_plan_id IN (
    SELECT id FROM workout_plans WHERE activity_id IN (
      SELECT id FROM activities WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "workout_completions_client_insert" ON workout_completions FOR INSERT TO authenticated
  WITH CHECK (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "workout_completions_client_read" ON workout_completions FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));
