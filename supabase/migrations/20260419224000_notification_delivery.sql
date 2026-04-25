-- This migration sets up the Supabase Webhook and (optional) Cron Job
-- Note: Replace [PROJECT_ID] and [SERVICE_ROLE_KEY] with your actual values if running manually.
-- In Lovable/Supabase projects, webhooks can also be configured via the Dashboard UI.

-- 1. Create Webhook to trigger Edge Function on NEW notifications
-- This handles immediate notifications (confirmation, new booking owner, cancellation)
-- Note: 'http_request' is part of supabase's net extension.
CREATE OR REPLACE FUNCTION trigger_notification_webhook()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for immediate notifications (no scheduled_for)
  -- Or if scheduled_for is already in the past
  IF (NEW.channel = 'email' AND (NEW.scheduled_for IS NULL OR NEW.scheduled_for <= NOW())) THEN
    PERFORM
      net.http_post(
        url := 'https://' || (SELECT value FROM settings WHERE key = 'supabase_project_id') || '.supabase.co/functions/v1/send-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM settings WHERE key = 'supabase_service_role_key')
        ),
        body := jsonb_build_object('record', row_to_json(NEW))
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the webhook on insert
DROP TRIGGER IF EXISTS trigger_notification_webhook ON notifications;
CREATE TRIGGER trigger_notification_webhook
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notification_webhook();


-- 2. Cron Job for Scheduled Reminders (runs every 15 minutes)
-- Requires pg_cron and pg_net extensions
-- SELECT cron.schedule('send-scheduled-notifications', '*/15 * * * *', $$
--   SELECT
--     net.http_post(
--       url := 'https://' || (SELECT value FROM settings WHERE key = 'supabase_project_id') || '.supabase.co/functions/v1/send-notification',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || (SELECT value FROM settings WHERE key = 'supabase_service_role_key')
--       ),
--       body := jsonb_build_object('notification_id', id)
--     )
--   FROM notifications
--   WHERE sent_at IS NULL 
--     AND scheduled_for IS NOT NULL 
--     AND scheduled_for <= NOW()
--     AND channel = 'email';
-- $$);
