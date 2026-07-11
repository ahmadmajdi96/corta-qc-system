
-- =========================================================
-- Enums for the new MES-linked QC surfaces
-- =========================================================
DO $$ BEGIN CREATE TYPE public.work_order_status AS ENUM ('planned','released','in_progress','completed','closed','on_hold'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.wo_operation_status AS ENUM ('pending','in_progress','completed','skipped','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.plan_type AS ENUM ('incoming','in_process','final'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.gage_status AS ENUM ('active','due','overdue','out_of_service'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.calibration_result AS ENUM ('pass','fail','conditional'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.msa_study_type AS ENUM ('gage_rr','linearity','bias','stability'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.msa_verdict AS ENUM ('acceptable','marginal','unacceptable'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.hold_status AS ENUM ('open','under_review','released','scrapped','rework'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.disposition AS ENUM ('use_as_is','rework','scrap','return_to_supplier'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.capa_methodology AS ENUM ('8d','5why','fishbone'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.capa_status AS ENUM ('draft','in_progress','verification','closed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.incoming_lot_status AS ENUM ('received','sampling','accepted','rejected','partial'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- Reusable updated_at trigger already exists as public.tg_set_updated_at
-- =========================================================

-- =========================================================
-- Production lines
-- =========================================================
CREATE TABLE public.production_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  area TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_lines TO authenticated;
GRANT ALL ON public.production_lines TO service_role;
ALTER TABLE public.production_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all lines" ON public.production_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage lines" ON public.production_lines FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "update lines" ON public.production_lines FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "delete lines" ON public.production_lines FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrator'));
CREATE TRIGGER trg_production_lines_updated BEFORE UPDATE ON public.production_lines FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- Stations
-- =========================================================
CREATE TABLE public.stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID REFERENCES public.production_lines(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  station_type TEXT,
  sequence INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_stations_line ON public.stations(line_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stations TO authenticated;
GRANT ALL ON public.stations TO service_role;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all stations" ON public.stations FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage stations" ON public.stations FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "update stations" ON public.stations FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "delete stations" ON public.stations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrator'));
CREATE TRIGGER trg_stations_updated BEFORE UPDATE ON public.stations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- Suppliers
-- =========================================================
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  contact_email TEXT,
  contact_phone TEXT,
  rating NUMERIC(3,2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrator'));
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- Work orders + operations
-- =========================================================
CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  lot_number TEXT,
  quantity_planned NUMERIC(14,3) NOT NULL DEFAULT 0,
  quantity_produced NUMERIC(14,3) NOT NULL DEFAULT 0,
  status public.work_order_status NOT NULL DEFAULT 'planned',
  line_id UUID REFERENCES public.production_lines(id) ON DELETE SET NULL,
  planned_start TIMESTAMPTZ,
  planned_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_work_orders_status ON public.work_orders(status);
CREATE INDEX idx_work_orders_product ON public.work_orders(product_id);
CREATE INDEX idx_work_orders_line ON public.work_orders(line_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all work orders" ON public.work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert work orders" ON public.work_orders FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer','inspector']));
CREATE POLICY "update work orders" ON public.work_orders FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer','inspector']));
CREATE POLICY "delete work orders" ON public.work_orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrator'));
CREATE TRIGGER trg_work_orders_updated BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.wo_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  station_id UUID REFERENCES public.stations(id) ON DELETE SET NULL,
  sequence INT NOT NULL DEFAULT 1,
  status public.wo_operation_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wo_ops_wo ON public.wo_operations(work_order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wo_operations TO authenticated;
GRANT ALL ON public.wo_operations TO service_role;
ALTER TABLE public.wo_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all wo ops" ON public.wo_operations FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage wo ops" ON public.wo_operations FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer','inspector']));
CREATE POLICY "update wo ops" ON public.wo_operations FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer','inspector']));
CREATE POLICY "delete wo ops" ON public.wo_operations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrator'));
CREATE TRIGGER trg_wo_ops_updated BEFORE UPDATE ON public.wo_operations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- Inspection plans + characteristics
-- =========================================================
CREATE TABLE public.inspection_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan_type public.plan_type NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  aql_level TEXT,
  sample_size_rule TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_inspection_plans_product ON public.inspection_plans(product_id);
CREATE UNIQUE INDEX ux_inspection_plans_active ON public.inspection_plans (product_id, plan_type) WHERE is_active = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_plans TO authenticated;
GRANT ALL ON public.inspection_plans TO service_role;
ALTER TABLE public.inspection_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read plans" ON public.inspection_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage plans" ON public.inspection_plans FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "update plans" ON public.inspection_plans FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "delete plans" ON public.inspection_plans FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrator'));
CREATE TRIGGER trg_inspection_plans_updated BEFORE UPDATE ON public.inspection_plans FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.plan_characteristics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.inspection_plans(id) ON DELETE CASCADE,
  spec_item_id UUID REFERENCES public.specification_items(id) ON DELETE SET NULL,
  sample_frequency TEXT,
  is_critical BOOLEAN NOT NULL DEFAULT FALSE,
  sequence INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_plan_chars_plan ON public.plan_characteristics(plan_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_characteristics TO authenticated;
GRANT ALL ON public.plan_characteristics TO service_role;
ALTER TABLE public.plan_characteristics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read plan chars" ON public.plan_characteristics FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage plan chars" ON public.plan_characteristics FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "update plan chars" ON public.plan_characteristics FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "delete plan chars" ON public.plan_characteristics FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrator'));
CREATE TRIGGER trg_plan_chars_updated BEFORE UPDATE ON public.plan_characteristics FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- Incoming lots
-- =========================================================
CREATE TABLE public.incoming_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  po_number TEXT,
  lot_number TEXT NOT NULL,
  received_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.incoming_lot_status NOT NULL DEFAULT 'received',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_incoming_lots_supplier ON public.incoming_lots(supplier_id);
CREATE INDEX idx_incoming_lots_status ON public.incoming_lots(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incoming_lots TO authenticated;
GRANT ALL ON public.incoming_lots TO service_role;
ALTER TABLE public.incoming_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read lots" ON public.incoming_lots FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage lots" ON public.incoming_lots FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer','inspector']));
CREATE POLICY "update lots" ON public.incoming_lots FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer','inspector']));
CREATE POLICY "delete lots" ON public.incoming_lots FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrator'));
CREATE TRIGGER trg_incoming_lots_updated BEFORE UPDATE ON public.incoming_lots FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- Gages + calibration + MSA
-- =========================================================
CREATE TABLE public.gages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  gage_type TEXT,
  manufacturer TEXT,
  serial_number TEXT,
  resolution NUMERIC(14,6),
  unit_id UUID REFERENCES public.measurement_units(id) ON DELETE SET NULL,
  last_cal_date DATE,
  next_cal_date DATE,
  status public.gage_status NOT NULL DEFAULT 'active',
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_gages_status ON public.gages(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gages TO authenticated;
GRANT ALL ON public.gages TO service_role;
ALTER TABLE public.gages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read gages" ON public.gages FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage gages" ON public.gages FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "update gages" ON public.gages FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "delete gages" ON public.gages FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrator'));
CREATE TRIGGER trg_gages_updated BEFORE UPDATE ON public.gages FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.calibration_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gage_id UUID NOT NULL REFERENCES public.gages(id) ON DELETE CASCADE,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  result public.calibration_result NOT NULL,
  certificate_ref TEXT,
  notes TEXT,
  next_due DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_calibration_gage ON public.calibration_records(gage_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calibration_records TO authenticated;
GRANT ALL ON public.calibration_records TO service_role;
ALTER TABLE public.calibration_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read calibration" ON public.calibration_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage calibration" ON public.calibration_records FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "update calibration" ON public.calibration_records FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "delete calibration" ON public.calibration_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrator'));

CREATE TABLE public.msa_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gage_id UUID NOT NULL REFERENCES public.gages(id) ON DELETE CASCADE,
  study_type public.msa_study_type NOT NULL,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  result JSONB,
  verdict public.msa_verdict,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_msa_gage ON public.msa_studies(gage_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.msa_studies TO authenticated;
GRANT ALL ON public.msa_studies TO service_role;
ALTER TABLE public.msa_studies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read msa" ON public.msa_studies FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage msa" ON public.msa_studies FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "update msa" ON public.msa_studies FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "delete msa" ON public.msa_studies FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrator'));

-- =========================================================
-- Quality holds
-- =========================================================
CREATE TABLE public.quality_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_number TEXT UNIQUE,
  lot_number TEXT,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  severity_id UUID REFERENCES public.severities(id) ON DELETE SET NULL,
  status public.hold_status NOT NULL DEFAULT 'open',
  disposition public.disposition,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_holds_status ON public.quality_holds(status);
CREATE INDEX idx_holds_wo ON public.quality_holds(work_order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_holds TO authenticated;
GRANT ALL ON public.quality_holds TO service_role;
ALTER TABLE public.quality_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read holds" ON public.quality_holds FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage holds" ON public.quality_holds FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer','inspector']));
CREATE POLICY "update holds" ON public.quality_holds FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "delete holds" ON public.quality_holds FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrator'));
CREATE TRIGGER trg_holds_updated BEFORE UPDATE ON public.quality_holds FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- CAPA records (8D)
-- =========================================================
CREATE TABLE public.capa_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_number TEXT UNIQUE,
  nc_id UUID REFERENCES public.non_conformances(id) ON DELETE SET NULL,
  methodology public.capa_methodology NOT NULL DEFAULT '8d',
  status public.capa_status NOT NULL DEFAULT 'draft',
  d1_team TEXT,
  d2_problem TEXT,
  d3_containment TEXT,
  d4_root_cause TEXT,
  d5_corrective TEXT,
  d6_implement TEXT,
  d7_prevent TEXT,
  d8_recognition TEXT,
  effectiveness_verified_at TIMESTAMPTZ,
  effectiveness_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_capa_nc ON public.capa_records(nc_id);
CREATE INDEX idx_capa_status ON public.capa_records(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capa_records TO authenticated;
GRANT ALL ON public.capa_records TO service_role;
ALTER TABLE public.capa_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read capa" ON public.capa_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage capa" ON public.capa_records FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "update capa" ON public.capa_records FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "delete capa" ON public.capa_records FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrator'));
CREATE TRIGGER trg_capa_updated BEFORE UPDATE ON public.capa_records FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- SPC samples
-- =========================================================
CREATE TABLE public.spc_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_item_id UUID REFERENCES public.specification_items(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  station_id UUID REFERENCES public.stations(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  sample_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  subgroup_id TEXT,
  subgroup_size INT,
  values JSONB,
  x_bar NUMERIC(14,6),
  r_value NUMERIC(14,6),
  sigma NUMERIC(14,6),
  ucl NUMERIC(14,6),
  lcl NUMERIC(14,6),
  cp NUMERIC(10,4),
  cpk NUMERIC(10,4),
  out_of_control_rules JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_spc_spec ON public.spc_samples(spec_item_id, sample_time DESC);
CREATE INDEX idx_spc_station ON public.spc_samples(station_id, sample_time DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spc_samples TO authenticated;
GRANT ALL ON public.spc_samples TO service_role;
ALTER TABLE public.spc_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read spc" ON public.spc_samples FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert spc" ON public.spc_samples FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer','inspector']));
CREATE POLICY "update spc" ON public.spc_samples FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer']));
CREATE POLICY "delete spc" ON public.spc_samples FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrator'));

-- =========================================================
-- Extend existing tables
-- =========================================================
ALTER TABLE public.inspections
  ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS station_id UUID REFERENCES public.stations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS line_id UUID REFERENCES public.production_lines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.inspection_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_type public.plan_type DEFAULT 'in_process',
  ADD COLUMN IF NOT EXISTS hold_id UUID REFERENCES public.quality_holds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS incoming_lot_id UUID REFERENCES public.incoming_lots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inspections_wo ON public.inspections(work_order_id);
CREATE INDEX IF NOT EXISTS idx_inspections_station ON public.inspections(station_id);

ALTER TABLE public.non_conformances
  ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hold_id UUID REFERENCES public.quality_holds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS capa_id UUID REFERENCES public.capa_records(id) ON DELETE SET NULL;

ALTER TABLE public.inspection_measurements
  ADD COLUMN IF NOT EXISTS gage_id UUID REFERENCES public.gages(id) ON DELETE SET NULL;
