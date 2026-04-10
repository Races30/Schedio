
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. Activities table
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('salone', 'coach')),
  owner_name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Rome',
  opening_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  opening_hours JSONB NOT NULL DEFAULT '{"start": "09:00", "end": "19:00"}',
  theme_color TEXT NOT NULL DEFAULT '#2563eb',
  logo_url TEXT,
  default_appointment_duration_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own activities" ON public.activities FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public can view activities" ON public.activities FOR SELECT USING (true);
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  preferences JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own clients" ON public.clients FOR ALL USING (
  activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())
) WITH CHECK (
  activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())
);
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Services table (for Salone)
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price NUMERIC(10,2),
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own services" ON public.services FOR ALL USING (
  activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())
) WITH CHECK (
  activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())
);
CREATE POLICY "Public can view active services" ON public.services FOR SELECT USING (true);

-- 4. Appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'cancelled', 'completed')),
  color TEXT,
  notes TEXT,
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own appointments" ON public.appointments FOR ALL USING (
  activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())
) WITH CHECK (
  activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())
);
CREATE POLICY "Public can insert appointments" ON public.appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view appointments for booking" ON public.appointments FOR SELECT USING (true);
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Packages table (for Coach)
CREATE TABLE public.packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_sessions INTEGER NOT NULL,
  used_sessions INTEGER NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own packages" ON public.packages FOR ALL USING (
  activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())
) WITH CHECK (
  activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())
);
CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Progress entries (for Coach)
CREATE TABLE public.progress_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  weight NUMERIC(5,2),
  notes TEXT,
  photo_url TEXT,
  measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.progress_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own progress" ON public.progress_entries FOR ALL USING (
  activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())
) WITH CHECK (
  activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())
);

-- 7. Availability blocks
CREATE TABLE public.availability_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  type TEXT NOT NULL DEFAULT 'available' CHECK (type IN ('available', 'blocked')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own availability" ON public.availability_blocks FOR ALL USING (
  activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())
) WITH CHECK (
  activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())
);
CREATE POLICY "Public can view availability" ON public.availability_blocks FOR SELECT USING (true);

-- Indexes
CREATE INDEX idx_activities_user_id ON public.activities(user_id);
CREATE INDEX idx_activities_slug ON public.activities(slug);
CREATE INDEX idx_clients_activity_id ON public.clients(activity_id);
CREATE INDEX idx_appointments_activity_id ON public.appointments(activity_id);
CREATE INDEX idx_appointments_date ON public.appointments(date);
CREATE INDEX idx_appointments_client_id ON public.appointments(client_id);
CREATE INDEX idx_services_activity_id ON public.services(activity_id);
CREATE INDEX idx_packages_activity_id ON public.packages(activity_id);
CREATE INDEX idx_packages_client_id ON public.packages(client_id);
CREATE INDEX idx_progress_entries_client_id ON public.progress_entries(client_id);
CREATE INDEX idx_availability_blocks_activity_id ON public.availability_blocks(activity_id);

-- Storage bucket for logos and photos
INSERT INTO storage.buckets (id, name, public) VALUES ('activity-assets', 'activity-assets', true);
CREATE POLICY "Public can view activity assets" ON storage.objects FOR SELECT USING (bucket_id = 'activity-assets');
CREATE POLICY "Auth users can upload assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'activity-assets' AND auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can update assets" ON storage.objects FOR UPDATE USING (bucket_id = 'activity-assets' AND auth.uid() IS NOT NULL);
CREATE POLICY "Auth users can delete assets" ON storage.objects FOR DELETE USING (bucket_id = 'activity-assets' AND auth.uid() IS NOT NULL);
