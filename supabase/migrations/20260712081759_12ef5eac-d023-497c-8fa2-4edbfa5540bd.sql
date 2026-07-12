
ALTER TABLE public.inspection_measurements
  ADD COLUMN IF NOT EXISTS result_details jsonb;

ALTER TABLE public.inspection_signoffs
  ADD COLUMN IF NOT EXISTS result_details jsonb,
  ADD COLUMN IF NOT EXISTS is_pass boolean;

ALTER TABLE public.non_conformances
  ADD COLUMN IF NOT EXISTS quarantine_location text,
  ADD COLUMN IF NOT EXISTS quarantine_qty numeric,
  ADD COLUMN IF NOT EXISTS quarantine_tag text,
  ADD COLUMN IF NOT EXISTS segregation_status text;
