CREATE TABLE IF NOT EXISTS weekly_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES activities(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  name varchar(100) NOT NULL DEFAULT 'Programma settimanale',
  days jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  is_active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_programs_activity ON weekly_programs(activity_id);
CREATE INDEX IF NOT EXISTS idx_weekly_programs_client_active ON weekly_programs(client_id, is_active);

ALTER TABLE weekly_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer_manage_weekly_programs"
ON weekly_programs FOR ALL
TO authenticated
USING (activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid()))
WITH CHECK (activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid()));

CREATE POLICY "client_read_weekly_program"
ON weekly_programs FOR SELECT
TO authenticated
USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));
