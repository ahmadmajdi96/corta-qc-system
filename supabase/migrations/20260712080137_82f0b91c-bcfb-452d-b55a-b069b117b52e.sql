-- Inspection plan header enrichments
ALTER TABLE public.inspection_plans
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS standard_reference TEXT;

-- Inspection & Test Plan rows on plan_characteristics
ALTER TABLE public.plan_characteristics
  ADD COLUMN IF NOT EXISTS activity TEXT,
  ADD COLUMN IF NOT EXISTS procedure TEXT,
  ADD COLUMN IF NOT EXISTS check_points TEXT,
  ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT,
  ADD COLUMN IF NOT EXISTS verifying_doc TEXT,
  ADD COLUMN IF NOT EXISTS inspected_by TEXT,
  ADD COLUMN IF NOT EXISTS comments TEXT,
  ADD COLUMN IF NOT EXISTS point_type TEXT,
  ADD COLUMN IF NOT EXISTS inspection_method TEXT;

ALTER TABLE public.plan_characteristics
  DROP CONSTRAINT IF EXISTS plan_characteristics_point_type_chk;
ALTER TABLE public.plan_characteristics
  ADD CONSTRAINT plan_characteristics_point_type_chk
  CHECK (point_type IS NULL OR point_type IN ('hold','witness','review'));

ALTER TABLE public.plan_characteristics
  DROP CONSTRAINT IF EXISTS plan_characteristics_method_chk;
ALTER TABLE public.plan_characteristics
  ADD CONSTRAINT plan_characteristics_method_chk
  CHECK (inspection_method IS NULL OR inspection_method IN ('dimensional','visual','ndt','functional'));

-- Make spec_item_id nullable so ITP rows without a spec item are allowed
ALTER TABLE public.plan_characteristics ALTER COLUMN spec_item_id DROP NOT NULL;

-- Inspections: stage + method
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS inspection_stage TEXT,
  ADD COLUMN IF NOT EXISTS inspection_method TEXT;

ALTER TABLE public.inspections
  DROP CONSTRAINT IF EXISTS inspections_stage_chk;
ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_stage_chk
  CHECK (inspection_stage IS NULL OR inspection_stage IN ('iqc','dupro','final'));

ALTER TABLE public.inspections
  DROP CONSTRAINT IF EXISTS inspections_method_chk;
ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_method_chk
  CHECK (inspection_method IS NULL OR inspection_method IN ('dimensional','visual','ndt','functional'));

-- Non-conformances: disposition + root-cause category
ALTER TABLE public.non_conformances
  ADD COLUMN IF NOT EXISTS disposition TEXT,
  ADD COLUMN IF NOT EXISTS root_cause_category TEXT;

ALTER TABLE public.non_conformances
  DROP CONSTRAINT IF EXISTS nc_disposition_chk;
ALTER TABLE public.non_conformances
  ADD CONSTRAINT nc_disposition_chk
  CHECK (disposition IS NULL OR disposition IN ('scrap','rework','repair','return_to_vendor','use_as_is'));

ALTER TABLE public.non_conformances
  DROP CONSTRAINT IF EXISTS nc_root_cause_chk;
ALTER TABLE public.non_conformances
  ADD CONSTRAINT nc_root_cause_chk
  CHECK (root_cause_category IS NULL OR root_cause_category IN ('human','equipment','material','process'));