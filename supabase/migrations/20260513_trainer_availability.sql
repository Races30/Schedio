-- Fasce di disponibilità settimanale del trainer
-- Idempotente: sicuro da rieseguire se già applicata via MCP

CREATE TABLE IF NOT EXISTS trainer_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES activities(id) ON DELETE CASCADE NOT NULL,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dom, 1=Lun...6=Sab
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trainer_availability ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Trainer: gestione completa
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trainer_availability'
      AND policyname = 'trainer_manage_availability'
  ) THEN
    CREATE POLICY "trainer_manage_availability"
      ON trainer_availability FOR ALL
      TO authenticated
      USING (activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid()))
      WITH CHECK (activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid()));
  END IF;

  -- Cliente: lettura disponibilità del proprio trainer
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trainer_availability'
      AND policyname = 'client_read_availability'
  ) THEN
    CREATE POLICY "client_read_availability"
      ON trainer_availability FOR SELECT
      TO authenticated
      USING (activity_id IN (SELECT activity_id FROM clients WHERE user_id = auth.uid()));
  END IF;
END $$;
