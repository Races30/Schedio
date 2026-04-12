
-- Create employees table
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  name text NOT NULL,
  surname text NOT NULL,
  slug text NOT NULL,
  token text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'dipendente',
  color text NOT NULL DEFAULT '#3b82f6',
  is_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view employees"
  ON public.employees FOR SELECT
  USING (true);

CREATE POLICY "Owner can manage employees"
  ON public.employees FOR ALL
  USING (activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid()))
  WITH CHECK (activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid()));

-- Create employee_services junction table
CREATE TABLE public.employee_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  UNIQUE(employee_id, service_id)
);

ALTER TABLE public.employee_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view employee_services"
  ON public.employee_services FOR SELECT
  USING (true);

CREATE POLICY "Owner can manage employee_services"
  ON public.employee_services FOR ALL
  USING (employee_id IN (
    SELECT e.id FROM public.employees e
    JOIN public.activities a ON a.id = e.activity_id
    WHERE a.user_id = auth.uid()
  ))
  WITH CHECK (employee_id IN (
    SELECT e.id FROM public.employees e
    JOIN public.activities a ON a.id = e.activity_id
    WHERE a.user_id = auth.uid()
  ));

-- Add employee_id to appointments
ALTER TABLE public.appointments
  ADD COLUMN employee_id uuid REFERENCES public.employees(id);

-- Add buffer_minutes to activities
ALTER TABLE public.activities
  ADD COLUMN buffer_minutes integer NOT NULL DEFAULT 5;
