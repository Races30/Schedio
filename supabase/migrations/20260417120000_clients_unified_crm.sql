-- Unified client management baseline for salone + coach.
-- Adds normalized identity fields, derived CRM metrics, and automatic sync from appointments/packages.

-- 1) Expand clients schema with normalized and derived fields.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS full_name_normalized text,
  ADD COLUMN IF NOT EXISTS phone_normalized text,
  ADD COLUMN IF NOT EXISTS email_normalized text,
  ADD COLUMN IF NOT EXISTS important_notes text,
  ADD COLUMN IF NOT EXISTS training_frequency text,
  ADD COLUMN IF NOT EXISTS last_booking_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_workout_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_service_name text,
  ADD COLUMN IF NOT EXISTS visit_frequency_days numeric,
  ADD COLUMN IF NOT EXISTS next_recommended_at timestamptz,
  ADD COLUMN IF NOT EXISTS active_package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sessions_purchased integer,
  ADD COLUMN IF NOT EXISTS sessions_used integer,
  ADD COLUMN IF NOT EXISTS sessions_remaining integer,
  ADD COLUMN IF NOT EXISTS package_expiry_date date,
  ADD COLUMN IF NOT EXISTS activity_status text;

-- 2) Accept no-show as appointment status.
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('confirmed', 'pending', 'cancelled', 'no-show', 'completed'));

-- 3) Useful lookup indexes for dedup.
CREATE INDEX IF NOT EXISTS idx_clients_activity_email_normalized
  ON public.clients (activity_id, email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_activity_phone_normalized
  ON public.clients (activity_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_activity_full_name_normalized
  ON public.clients (activity_id, full_name_normalized)
  WHERE full_name_normalized IS NOT NULL;

-- 4) Backfill baseline identity fields from existing names and contacts.
UPDATE public.clients
SET
  first_name = COALESCE(NULLIF(first_name, ''), split_part(name, ' ', 1)),
  last_name = COALESCE(
    NULLIF(last_name, ''),
    NULLIF(trim(substr(name, length(split_part(name, ' ', 1)) + 1)), '')
  ),
  full_name_normalized = lower(trim(regexp_replace(name, '\s+', ' ', 'g'))),
  email_normalized = CASE WHEN email IS NOT NULL THEN lower(trim(email)) ELSE NULL END,
  phone_normalized = CASE WHEN phone IS NOT NULL THEN regexp_replace(phone, '[^0-9+]', '', 'g') ELSE NULL END
WHERE true;

-- Safe backfill for activity_status (checks for legacy 'status' column)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'status') THEN
    UPDATE public.clients SET activity_status = COALESCE(activity_status, status, 'attivo');
  ELSE
    UPDATE public.clients SET activity_status = COALESCE(activity_status, 'attivo');
  END IF;
END $$;

-- 5) Recompute derived fields from operational data.
CREATE OR REPLACE FUNCTION public.recompute_client_metrics(p_client_id uuid)
RETURNS void AS $$
DECLARE
  v_activity_id uuid;
  v_category text;
BEGIN
  SELECT c.activity_id INTO v_activity_id
  FROM public.clients c
  WHERE c.id = p_client_id;

  IF v_activity_id IS NULL THEN
    RETURN;
  END IF;

  SELECT category INTO v_category
  FROM public.activities
  WHERE id = v_activity_id;

  -- Generic metrics for all tenants.
  UPDATE public.clients c
  SET
    last_booking_at = x.last_booking_at,
    last_completed_at = x.last_completed_at,
    visit_frequency_days = x.avg_frequency_days,
    next_recommended_at = CASE
      WHEN x.last_completed_at IS NULL OR x.avg_frequency_days IS NULL THEN NULL
      ELSE x.last_completed_at + make_interval(days => GREATEST(1, round(x.avg_frequency_days)::integer))
    END
  FROM (
    SELECT
      max((a.date::text || ' ' || a.start_time::text)::timestamptz) AS last_booking_at,
      max((a.date::text || ' ' || a.start_time::text)::timestamptz)
        FILTER (WHERE a.status = 'completed') AS last_completed_at,
      avg(gap_days) AS avg_frequency_days
    FROM (
      SELECT
        a.*,
        EXTRACT(day FROM (
          (a.date::text || ' ' || a.start_time::text)::timestamptz
          - lag((a.date::text || ' ' || a.start_time::text)::timestamptz) OVER (
            PARTITION BY a.client_id ORDER BY a.date, a.start_time
          )
        )) AS gap_days
      FROM public.appointments a
      WHERE a.client_id = p_client_id
        AND a.status IN ('confirmed', 'pending', 'completed')
    ) a
  ) x
  WHERE c.id = p_client_id;

  -- Last service (mostly meaningful for salone).
  UPDATE public.clients c
  SET
    last_service_id = x.service_id,
    last_service_name = x.service_name
  FROM (
    SELECT a.service_id, s.name AS service_name
    FROM public.appointments a
    LEFT JOIN public.services s ON s.id = a.service_id
    WHERE a.client_id = p_client_id
      AND a.status = 'completed'
      AND a.service_id IS NOT NULL
    ORDER BY a.date DESC, a.start_time DESC
    LIMIT 1
  ) x
  WHERE c.id = p_client_id;

  -- Coach specific package/session counters.
  IF v_category = 'coach' THEN
    UPDATE public.clients c
    SET
      active_package_id = x.package_id,
      sessions_purchased = x.total_sessions,
      sessions_used = x.used_sessions,
      sessions_remaining = GREATEST(x.total_sessions - x.used_sessions, 0),
      package_expiry_date = x.end_date,
      last_workout_at = (
        SELECT max((a.date::text || ' ' || a.start_time::text)::timestamptz)
        FROM public.appointments a
        WHERE a.client_id = p_client_id
          AND a.status = 'completed'
      )
    FROM (
      SELECT p.id AS package_id, p.total_sessions, p.used_sessions, p.end_date
      FROM public.packages p
      WHERE p.client_id = p_client_id
        AND p.status = 'active'
      ORDER BY p.created_at DESC
      LIMIT 1
    ) x
    WHERE c.id = p_client_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_client_metrics_from_appointment()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.client_id IS NOT NULL THEN
      PERFORM public.recompute_client_metrics(OLD.client_id);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.client_id IS NOT NULL THEN
    PERFORM public.recompute_client_metrics(NEW.client_id);
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.client_id IS DISTINCT FROM NEW.client_id
     AND OLD.client_id IS NOT NULL THEN
    PERFORM public.recompute_client_metrics(OLD.client_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_client_metrics_on_appointments ON public.appointments;
CREATE TRIGGER trigger_sync_client_metrics_on_appointments
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_metrics_from_appointment();

CREATE OR REPLACE FUNCTION public.sync_client_metrics_from_package()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_client_metrics(OLD.client_id);
    RETURN OLD;
  END IF;

  PERFORM public.recompute_client_metrics(NEW.client_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_client_metrics_on_packages ON public.packages;
CREATE TRIGGER trigger_sync_client_metrics_on_packages
AFTER INSERT OR UPDATE OR DELETE ON public.packages
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_metrics_from_package();

-- 6) Initial recomputation for all clients.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT id FROM public.clients LOOP
    PERFORM public.recompute_client_metrics(c.id);
  END LOOP;
END $$;
