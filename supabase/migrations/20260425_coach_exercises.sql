-- Coach Pro: Exercise Library & Progress Tracking
-- Creates trainer's reusable exercise database and per-client performance log

CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  measure_type TEXT NOT NULL DEFAULT 'ripetizioni',
  muscles JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exercises_name_max_len CHECK (char_length(name) <= 40),
  CONSTRAINT exercises_measure_type_check CHECK (
    measure_type IN ('ripetizioni', 'secondi', 'kg', 'metri')
  )
);

-- Per-client exercise performance tracking (one row per exercise per session)
CREATE TABLE IF NOT EXISTS exercise_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  value NUMERIC NOT NULL CHECK (value >= 0),
  measure_type TEXT NOT NULL,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exercise_progress_measure_type_check CHECK (
    measure_type IN ('ripetizioni', 'secondi', 'kg', 'metri')
  )
);

CREATE INDEX IF NOT EXISTS idx_exercises_activity_id
  ON exercises(activity_id);

-- Compound index optimised for "latest value for client+exercise" queries
CREATE INDEX IF NOT EXISTS idx_exercise_progress_lookup
  ON exercise_progress(client_id, exercise_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_exercise_progress_appointment
  ON exercise_progress(appointment_id);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercises_trainer_all"
  ON exercises FOR ALL TO authenticated
  USING (activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid()))
  WITH CHECK (activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid()));

CREATE POLICY "exercise_progress_trainer_all"
  ON exercise_progress FOR ALL TO authenticated
  USING (activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid()))
  WITH CHECK (activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid()));
