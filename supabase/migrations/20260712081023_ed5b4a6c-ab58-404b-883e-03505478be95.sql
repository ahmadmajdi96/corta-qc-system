
-- Phase 1: Hold/Witness/Review sign-offs + richer ITP rows

ALTER TABLE public.plan_characteristics
  ADD COLUMN IF NOT EXISTS tools text,
  ADD COLUMN IF NOT EXISTS responsibility_role text,
  ADD COLUMN IF NOT EXISTS required_documents jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.inspection_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  characteristic_id uuid NOT NULL REFERENCES public.plan_characteristics(id) ON DELETE CASCADE,
  point_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  signed_by uuid REFERENCES auth.users(id),
  signed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(inspection_id, characteristic_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_signoffs TO authenticated;
GRANT ALL ON public.inspection_signoffs TO service_role;

ALTER TABLE public.inspection_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signoff_select_all_authenticated"
  ON public.inspection_signoffs FOR SELECT TO authenticated USING (true);

CREATE POLICY "signoff_insert_authenticated"
  ON public.inspection_signoffs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "signoff_update_authenticated"
  ON public.inspection_signoffs FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "signoff_delete_privileged"
  ON public.inspection_signoffs FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']));

DROP TRIGGER IF EXISTS trg_inspection_signoffs_updated_at ON public.inspection_signoffs;
CREATE TRIGGER trg_inspection_signoffs_updated_at
  BEFORE UPDATE ON public.inspection_signoffs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_signoffs_inspection ON public.inspection_signoffs(inspection_id);
CREATE INDEX IF NOT EXISTS idx_signoffs_characteristic ON public.inspection_signoffs(characteristic_id);
