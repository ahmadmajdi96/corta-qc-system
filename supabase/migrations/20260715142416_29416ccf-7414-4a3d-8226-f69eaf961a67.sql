
-- ============================================================
-- Phase 1: QMS Foundation Tables & Extensions
-- ============================================================

-- 1. Organizational hierarchy ----------------------------------
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  compliance_profile TEXT NOT NULL DEFAULT 'iso9001',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY sites_read ON public.sites FOR SELECT TO authenticated USING (true);
CREATE POLICY sites_write ON public.sites FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']));
CREATE TRIGGER trg_sites_updated BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY departments_read ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY departments_write ON public.departments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']));
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(department_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_centers TO authenticated;
GRANT ALL ON public.work_centers TO service_role;
ALTER TABLE public.work_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY wc_read ON public.work_centers FOR SELECT TO authenticated USING (true);
CREATE POLICY wc_write ON public.work_centers FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']));
CREATE TRIGGER trg_wc_updated BEFORE UPDATE ON public.work_centers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Compliance profiles --------------------------------------
CREATE TABLE public.compliance_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  require_esig BOOLEAN NOT NULL DEFAULT false,
  require_second_person_verification BOOLEAN NOT NULL DEFAULT false,
  retention_years INT NOT NULL DEFAULT 7,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_profiles TO authenticated;
GRANT ALL ON public.compliance_profiles TO service_role;
ALTER TABLE public.compliance_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY cp_read ON public.compliance_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY cp_write ON public.compliance_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator'))
  WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER trg_cp_updated BEFORE UPDATE ON public.compliance_profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.compliance_profiles (code, name, description) VALUES
 ('iso9001','ISO 9001 General','Baseline general manufacturing QMS'),
 ('iatf16949','IATF 16949 Automotive','Automotive with customer-specific requirements'),
 ('as9100','AS/EN/JISQ 9100 Aerospace','Aviation, space, and defense'),
 ('iso13485','ISO 13485 + FDA QMSR','Medical devices, risk-based, Part 11 controls'),
 ('iso22000','ISO 22000 Food','Food safety with HACCP integration'),
 ('eugmp','EU GMP Pharma','Medicinal products, deviations, CAPA, audit trail')
ON CONFLICT (code) DO NOTHING;

-- 3. Extend inspection_plans with revision control -----------
ALTER TABLE public.inspection_plans
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revision_status TEXT NOT NULL DEFAULT 'draft', -- draft/approved/superseded/retired
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS effective_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_reason TEXT,
  ADD COLUMN IF NOT EXISTS parent_plan_id UUID REFERENCES public.inspection_plans(id),
  ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES public.inspection_plans(id),
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.sites(id);

-- Immutable snapshot of a plan revision at approval time
CREATE TABLE public.plan_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.inspection_plans(id) ON DELETE CASCADE,
  version INT NOT NULL,
  snapshot JSONB NOT NULL, -- frozen copy of plan + characteristics
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  change_reason TEXT,
  UNIQUE(plan_id, version)
);
GRANT SELECT, INSERT ON public.plan_revisions TO authenticated;
GRANT ALL ON public.plan_revisions TO service_role;
ALTER TABLE public.plan_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pr_read ON public.plan_revisions FOR SELECT TO authenticated USING (true);
CREATE POLICY pr_insert ON public.plan_revisions FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']));

-- Bind inspection to specific plan revision
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS plan_revision_id UUID REFERENCES public.plan_revisions(id),
  ADD COLUMN IF NOT EXISTS plan_version_at_execution INT,
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.sites(id),
  ADD COLUMN IF NOT EXISTS work_center_id UUID REFERENCES public.work_centers(id),
  ADD COLUMN IF NOT EXISTS environment JSONB, -- temp/humidity/cleanliness at execution
  ADD COLUMN IF NOT EXISTS sampling_state TEXT, -- normal/tightened/reduced
  ADD COLUMN IF NOT EXISTS lot_size INT,
  ADD COLUMN IF NOT EXISTS sample_size INT,
  ADD COLUMN IF NOT EXISTS inspected_qty INT;

-- 4. Reaction plans -------------------------------------------
CREATE TABLE public.reaction_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reaction_plans TO authenticated;
GRANT ALL ON public.reaction_plans TO service_role;
ALTER TABLE public.reaction_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_read ON public.reaction_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY rp_write ON public.reaction_plans FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']));
CREATE TRIGGER trg_rp_updated BEFORE UPDATE ON public.reaction_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.reaction_plan_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reaction_plan_id UUID NOT NULL REFERENCES public.reaction_plans(id) ON DELETE CASCADE,
  seq INT NOT NULL DEFAULT 1,
  action_type TEXT NOT NULL, -- stop_machine, quarantine_lot, quarantine_since_last_good, notify_role, create_ncr, increase_sampling, reinspect, escalate_capa
  target TEXT, -- role, machine, etc.
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reaction_plan_actions TO authenticated;
GRANT ALL ON public.reaction_plan_actions TO service_role;
ALTER TABLE public.reaction_plan_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY rpa_read ON public.reaction_plan_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY rpa_write ON public.reaction_plan_actions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']));

ALTER TABLE public.plan_characteristics
  ADD COLUMN IF NOT EXISTS reaction_plan_id UUID REFERENCES public.reaction_plans(id),
  ADD COLUMN IF NOT EXISTS criticality TEXT, -- critical/significant/key/standard
  ADD COLUMN IF NOT EXISTS safety_regulatory_flag BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_photo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_second_person BOOLEAN NOT NULL DEFAULT false;

-- 5. Electronic signatures ------------------------------------
CREATE TABLE public.electronic_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- inspection, plan, ncr, capa, hold, calibration, disposition
  entity_id UUID NOT NULL,
  entity_version INT,
  meaning TEXT NOT NULL, -- approved, released, verified, reviewed, rejected, witnessed
  signer_id UUID NOT NULL REFERENCES public.profiles(id),
  signer_role TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  reason TEXT,
  signature_hash TEXT
);
GRANT SELECT, INSERT ON public.electronic_signatures TO authenticated;
GRANT ALL ON public.electronic_signatures TO service_role;
ALTER TABLE public.electronic_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY esig_read ON public.electronic_signatures FOR SELECT TO authenticated USING (true);
CREATE POLICY esig_insert ON public.electronic_signatures FOR INSERT TO authenticated
  WITH CHECK (signer_id = auth.uid());
CREATE INDEX idx_esig_entity ON public.electronic_signatures(entity_type, entity_id);

-- 6. Amendments audit for controlled reopening -----------------
CREATE TABLE public.amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  amended_by UUID NOT NULL REFERENCES public.profiles(id),
  amended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL,
  before_state JSONB NOT NULL,
  after_state JSONB NOT NULL,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.amendments TO authenticated;
GRANT ALL ON public.amendments TO service_role;
ALTER TABLE public.amendments ENABLE ROW LEVEL SECURITY;
CREATE POLICY amend_read ON public.amendments FOR SELECT TO authenticated USING (true);
CREATE POLICY amend_insert ON public.amendments FOR INSERT TO authenticated
  WITH CHECK (amended_by = auth.uid() AND public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']));
CREATE INDEX idx_amend_entity ON public.amendments(entity_type, entity_id);

-- 7. SPC control limits (versioned, distinct from spec limits) --
CREATE TABLE public.spc_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  characteristic_id UUID REFERENCES public.plan_characteristics(id),
  product_id UUID REFERENCES public.products(id),
  station_id UUID REFERENCES public.stations(id),
  chart_type TEXT NOT NULL, -- imr, xbar_r, xbar_s, p, np, c, u, ewma, cusum
  subgroup_size INT,
  rule_set JSONB NOT NULL DEFAULT '{"nelson":[1,2,3,4,5,6,7,8]}'::jsonb,
  owner_id UUID REFERENCES public.profiles(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spc_charts TO authenticated;
GRANT ALL ON public.spc_charts TO service_role;
ALTER TABLE public.spc_charts ENABLE ROW LEVEL SECURITY;
CREATE POLICY spc_charts_read ON public.spc_charts FOR SELECT TO authenticated USING (true);
CREATE POLICY spc_charts_write ON public.spc_charts FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']));
CREATE TRIGGER trg_spc_charts_updated BEFORE UPDATE ON public.spc_charts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.spc_control_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id UUID NOT NULL REFERENCES public.spc_charts(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  center_line NUMERIC NOT NULL,
  ucl NUMERIC NOT NULL,
  lcl NUMERIC NOT NULL,
  sigma_method TEXT, -- within/overall
  baseline_from TIMESTAMPTZ,
  baseline_to TIMESTAMPTZ,
  sample_count INT,
  reason TEXT NOT NULL,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  UNIQUE(chart_id, version)
);
GRANT SELECT, INSERT ON public.spc_control_limits TO authenticated;
GRANT ALL ON public.spc_control_limits TO service_role;
ALTER TABLE public.spc_control_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY scl_read ON public.spc_control_limits FOR SELECT TO authenticated USING (true);
CREATE POLICY scl_insert ON public.spc_control_limits FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']));

CREATE TABLE public.spc_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id UUID NOT NULL REFERENCES public.spc_charts(id) ON DELETE CASCADE,
  sample_id UUID REFERENCES public.spc_samples(id),
  rule_violated TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspect_window_start TIMESTAMPTZ,
  suspect_window_end TIMESTAMPTZ,
  linked_nc_id UUID REFERENCES public.non_conformances(id),
  linked_hold_id UUID REFERENCES public.quality_holds(id),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);
GRANT SELECT, INSERT, UPDATE ON public.spc_signals TO authenticated;
GRANT ALL ON public.spc_signals TO service_role;
ALTER TABLE public.spc_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY sig_read ON public.spc_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY sig_write ON public.spc_signals FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']));

CREATE TABLE public.capability_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id UUID NOT NULL REFERENCES public.spc_charts(id) ON DELETE CASCADE,
  characteristic_id UUID REFERENCES public.plan_characteristics(id),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sample_count INT NOT NULL,
  mean NUMERIC,
  sigma_within NUMERIC,
  sigma_overall NUMERIC,
  cp NUMERIC,
  cpk NUMERIC,
  pp NUMERIC,
  ppk NUMERIC,
  required_cpk NUMERIC,
  prerequisites_met BOOLEAN NOT NULL DEFAULT false,
  notes TEXT
);
GRANT SELECT, INSERT ON public.capability_studies TO authenticated;
GRANT ALL ON public.capability_studies TO service_role;
ALTER TABLE public.capability_studies ENABLE ROW LEVEL SECURITY;
CREATE POLICY cap_read ON public.capability_studies FOR SELECT TO authenticated USING (true);
CREATE POLICY cap_insert ON public.capability_studies FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']));

-- 8. Gauge usage history for OOT impact tracing ---------------
CREATE TABLE public.gauge_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gage_id UUID NOT NULL REFERENCES public.gages(id) ON DELETE CASCADE,
  inspection_id UUID REFERENCES public.inspections(id),
  measurement_id UUID REFERENCES public.inspection_measurements(id),
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_by UUID REFERENCES public.profiles(id),
  calibration_status_at_use TEXT NOT NULL, -- in_cal, due_soon, overdue, oot
  last_cal_id UUID REFERENCES public.calibration_records(id)
);
GRANT SELECT, INSERT ON public.gauge_usage_history TO authenticated;
GRANT ALL ON public.gauge_usage_history TO service_role;
ALTER TABLE public.gauge_usage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY guh_read ON public.gauge_usage_history FOR SELECT TO authenticated USING (true);
CREATE POLICY guh_insert ON public.gauge_usage_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_guh_gage_time ON public.gauge_usage_history(gage_id, used_at);

-- 9. Extend calibration_records + gages -----------------------
ALTER TABLE public.calibration_records
  ADD COLUMN IF NOT EXISTS as_found JSONB, -- readings before adjustment
  ADD COLUMN IF NOT EXISTS as_left JSONB,  -- readings after adjustment
  ADD COLUMN IF NOT EXISTS is_oot BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS oot_magnitude NUMERIC,
  ADD COLUMN IF NOT EXISTS oot_direction TEXT,
  ADD COLUMN IF NOT EXISTS reference_standard_id TEXT,
  ADD COLUMN IF NOT EXISTS reference_cert_number TEXT,
  ADD COLUMN IF NOT EXISTS uncertainty NUMERIC,
  ADD COLUMN IF NOT EXISTS uncertainty_unit TEXT,
  ADD COLUMN IF NOT EXISTS environmental_conditions JSONB,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_accreditation TEXT,
  ADD COLUMN IF NOT EXISTS impact_assessment_id UUID;

CREATE TABLE public.oot_impact_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibration_record_id UUID NOT NULL REFERENCES public.calibration_records(id) ON DELETE CASCADE,
  gage_id UUID NOT NULL REFERENCES public.gages(id),
  last_known_good_at TIMESTAMPTZ,
  suspect_window_start TIMESTAMPTZ NOT NULL,
  suspect_window_end TIMESTAMPTZ NOT NULL,
  affected_inspection_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  affected_lot_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  risk_summary TEXT,
  disposition TEXT, -- no_impact, reinspect, hold, recall
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  linked_nc_id UUID REFERENCES public.non_conformances(id),
  linked_capa_id UUID REFERENCES public.capa_records(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.oot_impact_assessments TO authenticated;
GRANT ALL ON public.oot_impact_assessments TO service_role;
ALTER TABLE public.oot_impact_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY oia_read ON public.oot_impact_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY oia_write ON public.oot_impact_assessments FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer','calibration_coordinator']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer','calibration_coordinator']));
CREATE TRIGGER trg_oia_updated BEFORE UPDATE ON public.oot_impact_assessments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.gages
  ADD COLUMN IF NOT EXISTS mpe NUMERIC, -- max permissible error
  ADD COLUMN IF NOT EXISTS resolution NUMERIC,
  ADD COLUMN IF NOT EXISTS accuracy NUMERIC,
  ADD COLUMN IF NOT EXISTS uncertainty NUMERIC,
  ADD COLUMN IF NOT EXISTS criticality TEXT DEFAULT 'standard', -- critical/standard
  ADD COLUMN IF NOT EXISTS interval_basis TEXT DEFAULT 'time', -- time/usage
  ADD COLUMN IF NOT EXISTS interval_value INT,
  ADD COLUMN IF NOT EXISTS interval_unit TEXT DEFAULT 'months',
  ADD COLUMN IF NOT EXISTS usage_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS control_class TEXT DEFAULT 'calibration_required', -- calibration_required/verification_only/reference_standard/test_fixture/monitoring
  ADD COLUMN IF NOT EXISTS restricted_use BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qr_label TEXT;

-- 10. NC quantity reconciliation + COPQ ----------------------
ALTER TABLE public.non_conformances
  ADD COLUMN IF NOT EXISTS qty_affected NUMERIC,
  ADD COLUMN IF NOT EXISTS qty_released NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_reworked NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_scrapped NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_returned NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_use_as_is NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_downgraded NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_remaining_held NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_uom TEXT DEFAULT 'ea',
  ADD COLUMN IF NOT EXISTS requirement_reference TEXT,
  ADD COLUMN IF NOT EXISTS defect_code TEXT,
  ADD COLUMN IF NOT EXISTS defect_class TEXT,
  ADD COLUMN IF NOT EXISTS is_repeat_occurrence BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS repeat_of_nc_id UUID REFERENCES public.non_conformances(id),
  ADD COLUMN IF NOT EXISTS suspect_window_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspect_window_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cost_scrap NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_rework NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_sort NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_downtime NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_freight_return NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_warranty NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS copq_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS linked_spc_signal_id UUID REFERENCES public.spc_signals(id),
  ADD COLUMN IF NOT EXISTS linked_oot_id UUID REFERENCES public.oot_impact_assessments(id);

-- Disposition line-items for accurate qty accounting
CREATE TABLE public.nc_disposition_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_id UUID NOT NULL REFERENCES public.non_conformances(id) ON DELETE CASCADE,
  disposition TEXT NOT NULL, -- release, rework, scrap, return, use_as_is, downgrade, sort
  qty NUMERIC NOT NULL,
  location TEXT,
  reinspection_required BOOLEAN NOT NULL DEFAULT false,
  reinspection_id UUID REFERENCES public.inspections(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nc_disposition_lines TO authenticated;
GRANT ALL ON public.nc_disposition_lines TO service_role;
ALTER TABLE public.nc_disposition_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY ncdl_read ON public.nc_disposition_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY ncdl_write ON public.nc_disposition_lines FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']));
CREATE TRIGGER trg_ncdl_updated BEFORE UPDATE ON public.nc_disposition_lines FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 11. Hold scope actions ledger (partial release qty ledger) --
CREATE TABLE public.hold_scope_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id UUID NOT NULL REFERENCES public.quality_holds(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- add, remove, release_partial, release_full
  qty_delta NUMERIC NOT NULL,
  before_qty NUMERIC NOT NULL,
  after_qty NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  authorized_by UUID NOT NULL REFERENCES public.profiles(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.hold_scope_actions TO authenticated;
GRANT ALL ON public.hold_scope_actions TO service_role;
ALTER TABLE public.hold_scope_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY hsa_read ON public.hold_scope_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY hsa_insert ON public.hold_scope_actions FOR INSERT TO authenticated
  WITH CHECK (authorized_by = auth.uid());

ALTER TABLE public.quality_holds
  ADD COLUMN IF NOT EXISTS qty_held NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_uom TEXT DEFAULT 'ea',
  ADD COLUMN IF NOT EXISTS hard_block BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quarantine_tag TEXT,
  ADD COLUMN IF NOT EXISTS quarantine_location TEXT,
  ADD COLUMN IF NOT EXISTS release_criteria JSONB,
  ADD COLUMN IF NOT EXISTS release_criteria_met JSONB;

-- 12. Notifications ------------------------------------------
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- inspection_due, capa_action, calibration_due, hold_aging, escalation, oot
  severity TEXT NOT NULL DEFAULT 'info',
  entity_type TEXT,
  entity_id UUID,
  title TEXT NOT NULL,
  body TEXT,
  action_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_read ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR public.has_role(auth.uid(),'administrator'));
CREATE POLICY notif_update ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid());
CREATE POLICY notif_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_notif_recipient_unread ON public.notifications(recipient_id, read_at);

-- 13. Escalations -------------------------------------------
CREATE TABLE public.escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  level INT NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  escalated_to UUID REFERENCES public.profiles(id),
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES public.profiles(id)
);
GRANT SELECT, INSERT, UPDATE ON public.escalations TO authenticated;
GRANT ALL ON public.escalations TO service_role;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY esc_read ON public.escalations FOR SELECT TO authenticated USING (true);
CREATE POLICY esc_write ON public.escalations FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']));
CREATE INDEX idx_esc_entity ON public.escalations(entity_type, entity_id);

-- 14. Add missing roles ------------------------------------
INSERT INTO public.roles (name, description) VALUES
  ('quality_manager','Owns QMS configuration, approvals, KPIs, CAPA governance'),
  ('quality_engineer','Builds plans, investigates NCRs, manages CAPA and SPC'),
  ('inspector','Executes inspections, records measurements, initiates NCR'),
  ('supervisor','Coordinates containment, rework and line actions'),
  ('warehouse_controller','Physical segregation, quarantine movement, release'),
  ('supplier_quality_engineer','Manages supplier NCRs, SCARs, incoming performance'),
  ('calibration_coordinator','Gauge register, calibration schedule, OOT investigations'),
  ('disposition_approver','Approves use-as-is, concession, scrap, return, release')
ON CONFLICT (name) DO NOTHING;

-- 15. Utility: quantity reconciliation helper ------------------
CREATE OR REPLACE FUNCTION public.nc_qty_reconciles(_nc_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(nc.qty_affected,0) =
         COALESCE(nc.qty_released,0)+COALESCE(nc.qty_reworked,0)+COALESCE(nc.qty_scrapped,0)+
         COALESCE(nc.qty_returned,0)+COALESCE(nc.qty_use_as_is,0)+COALESCE(nc.qty_downgraded,0)+
         COALESCE(nc.qty_remaining_held,0)
  FROM public.non_conformances nc WHERE nc.id=_nc_id;
$$;
