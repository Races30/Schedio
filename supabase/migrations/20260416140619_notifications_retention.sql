-- Add tracking columns out of the box to clients
ALTER TABLE clients ADD COLUMN status VARCHAR(20) DEFAULT 'attivo';
ALTER TABLE clients ADD COLUMN status_reason TEXT;

-- Enums
CREATE TYPE notification_type AS ENUM ('reminder_24h', 'no-show_alert', 'retention_inactive', 'package_expiring', 'system');
CREATE TYPE notification_channel AS ENUM ('internal', 'email', 'sms', 'whatsapp');

-- Notifications table
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  type notification_type NOT NULL DEFAULT 'system',
  channel notification_channel NOT NULL DEFAULT 'internal',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notifications" ON notifications 
FOR ALL USING (
  activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid())
);

-- Database trigger to update client status automatically on appointment changes
CREATE OR REPLACE FUNCTION update_client_status_on_appointment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE clients SET status = 'attivo', status_reason = null WHERE id = NEW.client_id;
  ELSIF NEW.status = 'no-show' THEN
    UPDATE clients SET status = 'no-show', status_reason = 'Mancato al check-in recente' WHERE id = NEW.client_id;
    -- create internal notification immediately
    INSERT INTO notifications (activity_id, client_id, type, title, message)
    VALUES (NEW.activity_id, NEW.client_id, 'no-show_alert', 'No-Show registrato', 'Registrato no-show per ' || COALESCE((SELECT name FROM clients WHERE id = NEW.client_id), 'il cliente'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_client_status
  AFTER UPDATE OF status ON appointments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_client_status_on_appointment();


-- Function to explicitly calculate and log retention/inactivity
-- It processes clients and package based on activity type, without spamming duplicates.
CREATE OR REPLACE FUNCTION generate_retention_alerts(target_activity_id UUID)
RETURNS void AS $$
DECLARE
  v_category VARCHAR;
BEGIN
  -- We identify the type of tenant directly from activities
  SELECT category INTO v_category FROM activities WHERE id = target_activity_id;

  IF v_category = 'salone' THEN
    -- Salone: 60 giorni inattività
    UPDATE clients 
    SET status = 'da ricontattare', status_reason = 'Nessuna prenotazione da oltre 60 giorni'
    WHERE activity_id = target_activity_id 
      AND status = 'attivo'
      AND id IN (
        SELECT client_id FROM appointments 
        WHERE activity_id = target_activity_id AND client_id IS NOT NULL 
        GROUP BY client_id 
        HAVING MAX(date::timestamp) < (NOW() - INTERVAL '60 days')
      );
      
  ELSIF v_category = 'personal_trainer' THEN
    -- Coach: 21 giorni inattività (3 settimane)
    UPDATE clients 
    SET status = 'inattivo', status_reason = 'Nessuna seduta da oltre 3 settimane'
    WHERE activity_id = target_activity_id 
      AND status = 'attivo'
      AND id IN (
        SELECT client_id FROM appointments 
        WHERE activity_id = target_activity_id AND client_id IS NOT NULL 
        GROUP BY client_id 
        HAVING MAX(date::timestamp) < (NOW() - INTERVAL '21 days')
      );
      
    -- Notify packages ending
    INSERT INTO notifications (activity_id, client_id, type, title, message)
    SELECT p.activity_id, p.client_id, 'package_expiring', 'Pacchetto in scadenza', 'Il pacchetto "' || p.name || '" per ' || COALESCE((SELECT name FROM clients WHERE id = p.client_id), '') || ' ha superato l''80% o mancano pochissime sedute.'
    FROM packages p
    WHERE p.activity_id = target_activity_id
      AND p.status = 'active'
      AND p.total_sessions > 0
      AND p.used_sessions >= p.total_sessions * 0.8
      AND NOT EXISTS (
        SELECT 1 FROM notifications n WHERE n.client_id = p.client_id AND n.type = 'package_expiring' AND n.created_at > (NOW() - INTERVAL '30 days')
      );
  END IF;

  -- Create missing read-worthy notifications for inactive/to-contact clients
  INSERT INTO notifications (activity_id, client_id, type, title, message)
  SELECT c.activity_id, c.id, 'retention_inactive', 'Cliente da ricontattare', 'Cliente ' || c.name || ' è inattivo / da ricontattare. (' || c.status_reason || ')'
  FROM clients c
  WHERE c.activity_id = target_activity_id
    AND (c.status = 'da ricontattare' OR c.status = 'inattivo')
    AND NOT EXISTS (
        SELECT 1 FROM notifications n WHERE n.client_id = c.id AND n.type = 'retention_inactive' AND n.created_at > (NOW() - INTERVAL '30 days')
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
