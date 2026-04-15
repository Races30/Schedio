ALTER TABLE public.activities ADD COLUMN max_advance_booking_days integer NOT NULL DEFAULT 60;
ALTER TABLE public.activities ADD COLUMN min_booking_notice_hours integer NOT NULL DEFAULT 2;