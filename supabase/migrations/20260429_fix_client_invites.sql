-- Ensure the clients table has the invitation fields
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'invite_token') THEN
    ALTER TABLE clients ADD COLUMN invite_token TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'invite_sent') THEN
    ALTER TABLE clients ADD COLUMN invite_sent BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'invite_accepted') THEN
    ALTER TABLE clients ADD COLUMN invite_accepted BOOLEAN DEFAULT false;
  END IF;
END $$;
