-- Allow public (anonymous) users to interact with clients during booking flow
-- 1) Allow public to insert new clients
CREATE POLICY "Public can insert clients" ON public.clients 
FOR INSERT WITH CHECK (true);

-- 2) Allow public to select clients for matching (based on activity_id)
-- Note: This is required for the "findOrCreateClient" logic to check for duplicates
CREATE POLICY "Public can select clients for matching" ON public.clients 
FOR SELECT USING (true);

-- 3) Allow public to update clients (to backfill info during booking)
CREATE POLICY "Public can update clients" ON public.clients 
FOR UPDATE USING (true);

-- Ensure appointments also has full public insert permissions 
-- (Sometimes existing policies are too restrictive)
DROP POLICY IF EXISTS "Public can insert appointments" ON public.appointments;
CREATE POLICY "Public can insert appointments" ON public.appointments 
FOR INSERT WITH CHECK (true);

-- Ensure public can view appointments (to see busy slots)
DROP POLICY IF EXISTS "Public can view appointments for booking" ON public.appointments;
CREATE POLICY "Public can view appointments for booking" ON public.appointments 
FOR SELECT USING (true);
