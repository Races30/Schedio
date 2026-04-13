-- Add description to activities (coach bio/specialization)
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS description text;

-- Add coach-specific fields to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS objective text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS frequency text;

-- Add body measurement columns to progress_entries
ALTER TABLE public.progress_entries ADD COLUMN IF NOT EXISTS waist numeric;
ALTER TABLE public.progress_entries ADD COLUMN IF NOT EXISTS hips numeric;
ALTER TABLE public.progress_entries ADD COLUMN IF NOT EXISTS chest numeric;
ALTER TABLE public.progress_entries ADD COLUMN IF NOT EXISTS arms numeric;
ALTER TABLE public.progress_entries ADD COLUMN IF NOT EXISTS thighs numeric;

-- Add price to packages
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS price numeric;

-- Add description to services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS description text;