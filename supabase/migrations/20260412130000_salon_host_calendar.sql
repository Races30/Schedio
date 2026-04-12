-- Salon: host optional as employee, employee active flag, appointment buffer, service metadata

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS host_works_in_salon boolean NOT NULL DEFAULT true;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_employees_updated_at ON public.employees;
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS buffer_time_minutes integer NOT NULL DEFAULT 0;

-- Assign missing employee_id using first active employee per activity (best effort)
UPDATE public.appointments a
SET employee_id = sub.emp_id
FROM (
  SELECT
    a2.id AS appt_id,
    (
      SELECT e.id
      FROM public.employees e
      WHERE e.activity_id = a2.activity_id
        AND e.is_active = true
      ORDER BY e.is_owner DESC, e.created_at ASC
      LIMIT 1
    ) AS emp_id
  FROM public.appointments a2
  WHERE a2.employee_id IS NULL
) sub
WHERE a.id = sub.appt_id
  AND sub.emp_id IS NOT NULL;
