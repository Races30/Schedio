
DROP POLICY "Public can insert appointments" ON public.appointments;
CREATE POLICY "Public can insert appointments" ON public.appointments FOR INSERT WITH CHECK (
  activity_id IN (SELECT id FROM public.activities)
);
