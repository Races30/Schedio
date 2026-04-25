-- Update notification types
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_confirmation';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'booking_cancellation';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_booking_owner';

-- Improved triggers for email notifications on appointments
CREATE OR REPLACE FUNCTION handle_appointment_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_client_name TEXT;
  v_activity_name TEXT;
  v_activity_owner_email TEXT;
BEGIN
  -- Get context
  SELECT name INTO v_client_name FROM clients WHERE id = NEW.client_id;
  SELECT name, u.email INTO v_activity_name, v_activity_owner_email 
  FROM activities a
  JOIN auth.users u ON a.user_id = u.id
  WHERE a.id = NEW.activity_id;

  -- 1. Confirmation for the Client
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO notifications (activity_id, client_id, type, channel, title, message)
    VALUES (
      NEW.activity_id, 
      NEW.client_id, 
      'booking_confirmation', 
      'email',
      'Conferma prenotazione',
      'Gentile ' || COALESCE(v_client_name, 'cliente') || ', il tuo appuntamento presso ' || v_activity_name || ' il ' || to_char(NEW.date, 'DD/MM/YYYY') || ' alle ' || NEW.start_time || ' è confermato.'
    );

    -- 2. Notification for the Owner/Coach
    INSERT INTO notifications (activity_id, client_id, type, channel, title, message)
    VALUES (
      NEW.activity_id, 
      NEW.client_id, 
      'new_booking_owner', 
      'email',
      'Nuova prenotazione ricevuta',
      'Hai ricevuto una nuova prenotazione da ' || COALESCE(v_client_name, 'un cliente') || ' per il ' || to_char(NEW.date, 'DD/MM/YYYY') || ' alle ' || NEW.start_time || '.'
    );

    -- 3. Scheduled Reminder (24h before)
    -- Only if the appointment is more than 24h away
    IF (NEW.date::timestamp + (NEW.start_time::time)::interval > (NOW() + INTERVAL '24 hours')) THEN
      INSERT INTO notifications (activity_id, client_id, type, channel, title, message, scheduled_for)
      VALUES (
        NEW.activity_id, 
        NEW.client_id, 
        'reminder_24h', 
        'email',
        'Promemoria appuntamento domani',
        'Ricordati del tuo appuntamento domani alle ' || NEW.start_time || ' presso ' || v_activity_name || '.',
        (NEW.date::timestamp + (NEW.start_time::time)::interval) - INTERVAL '24 hours'
      );
    END IF;
  END IF;

  -- 4. Cancellation Notification
  IF (TG_OP = 'UPDATE' AND OLD.status != 'cancelled' AND NEW.status = 'cancelled') THEN
    INSERT INTO notifications (activity_id, client_id, type, channel, title, message)
    VALUES (
      NEW.activity_id, 
      NEW.client_id, 
      'booking_cancellation', 
      'email',
      'Appuntemento annullato',
      'Il tuo appuntamento del ' || to_char(NEW.date, 'DD/MM/YYYY') || ' alle ' || NEW.start_time || ' è stato annullato.'
    );
    
    -- Also notify owner
    INSERT INTO notifications (activity_id, client_id, type, channel, title, message)
    VALUES (
      NEW.activity_id, 
      NEW.client_id, 
      'new_booking_owner', -- Reuse or could be 'cancellation_owner'
      'email',
      'Prenotazione annullata',
      'La prenotazione di ' || COALESCE(v_client_name, 'un cliente') || ' per il ' || to_char(NEW.date, 'DD/MM/YYYY') || ' alle ' || NEW.start_time || ' è stata annullata.'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger
DROP TRIGGER IF EXISTS trigger_appointment_notifications ON appointments;
CREATE TRIGGER trigger_appointment_notifications
  AFTER INSERT OR UPDATE OF status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION handle_appointment_notifications();

-- Setup for Webhook (logic to be used by Supabase Admin)
-- We need to call an Edge Function when a new notification is created with channel 'email' and scheduled_for IS NULL (immediate)
-- For scheduled ones, they'll be picked up by a cron job later.
