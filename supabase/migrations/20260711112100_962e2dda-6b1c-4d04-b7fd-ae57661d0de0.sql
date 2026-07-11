
-- Allow non-conformances to be raised outside of an inspection (manual entry from board)
ALTER TABLE public.non_conformances ALTER COLUMN inspection_id DROP NOT NULL;

-- Add "Mark N/A" + attachment to measurements
ALTER TABLE public.inspection_measurements
  ADD COLUMN IF NOT EXISTS is_na BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Cancel reason on inspections
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Export jobs history (records CSV/PDF exports)
CREATE TABLE IF NOT EXISTS public.export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL,
  format TEXT NOT NULL,
  filters JSONB,
  row_count INT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.export_jobs TO authenticated;
GRANT ALL ON public.export_jobs TO service_role;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "export jobs own read" ON public.export_jobs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['administrator','auditor']));
CREATE POLICY "export jobs own insert" ON public.export_jobs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
