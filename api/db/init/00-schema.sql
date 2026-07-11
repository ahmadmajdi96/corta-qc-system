-- CORTA QC — Full Postgres schema for self-hosted docker-compose deployment.
-- Loaded automatically by the postgres image on first boot.
-- Mirrors the 15 tables described in the product documentation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Roles / Permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(50) UNIQUE NOT NULL,
  description  TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource     VARCHAR(50) NOT NULL,
  action       VARCHAR(50) NOT NULL,
  UNIQUE(resource, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(255) UNIQUE NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  full_name      VARCHAR(255) NOT NULL,
  avatar_url     TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id  UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

-- ============================================================
-- Profiles (kept for parity with Cloud schema)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  full_name   VARCHAR(255),
  avatar_url  TEXT,
  phone       VARCHAR(50),
  department  VARCHAR(100),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Settings tables
-- ============================================================
CREATE TABLE IF NOT EXISTS measurement_units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(20) UNIQUE NOT NULL,
  label       VARCHAR(100) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS severities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(30) UNIQUE NOT NULL,
  label       VARCHAR(100) NOT NULL,
  weight      INT NOT NULL DEFAULT 0,
  color       VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS product_categories (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name   VARCHAR(100) UNIQUE NOT NULL,
  parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL
);

-- ============================================================
-- Products / Specs
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku           VARCHAR(80) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  category_id   UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

CREATE TABLE IF NOT EXISTS quality_specifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version      INT NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'draft',
  effective_from TIMESTAMPTZ,
  effective_to   TIMESTAMPTZ,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, version)
);
CREATE INDEX IF NOT EXISTS idx_specs_product ON quality_specifications(product_id);
-- AC-10: only ONE active version per product
CREATE UNIQUE INDEX IF NOT EXISTS ux_specs_one_active_per_product
  ON quality_specifications(product_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS specification_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specification_id  UUID NOT NULL REFERENCES quality_specifications(id) ON DELETE CASCADE,
  parameter         VARCHAR(255) NOT NULL,
  unit_id           UUID REFERENCES measurement_units(id),
  min_value         NUMERIC,
  max_value         NUMERIC,
  target_value      NUMERIC,
  is_required       BOOLEAN NOT NULL DEFAULT TRUE,
  method            TEXT,
  sort_order        INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_spec_items_spec ON specification_items(specification_id);

-- ============================================================
-- Inspections
-- ============================================================
CREATE TABLE IF NOT EXISTS inspection_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  cadence       VARCHAR(30) NOT NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  assigned_to   UUID REFERENCES users(id),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  notes         TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inspections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            UUID NOT NULL REFERENCES products(id),
  specification_id      UUID REFERENCES quality_specifications(id),
  schedule_id           UUID REFERENCES inspection_schedules(id) ON DELETE SET NULL,
  inspector_id          UUID REFERENCES users(id),
  lot_number            VARCHAR(120),
  status                VARCHAR(30) NOT NULL DEFAULT 'planned',
  scheduled_for         TIMESTAMPTZ NOT NULL,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancel_reason         TEXT,
  notes                 TEXT,
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inspections_product ON inspections(product_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_scheduled ON inspections(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector ON inspections(inspector_id);

CREATE TABLE IF NOT EXISTS inspection_measurements (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id          UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  specification_item_id  UUID NOT NULL REFERENCES specification_items(id),
  value_numeric          NUMERIC,
  value_text             TEXT,
  is_pass                BOOLEAN,
  is_na                  BOOLEAN NOT NULL DEFAULT FALSE,
  attachment_url         TEXT,
  note                   TEXT,
  recorded_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_measurements_inspection ON inspection_measurements(inspection_id);

-- ============================================================
-- Non-conformances
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS nc_number_seq;

CREATE TABLE IF NOT EXISTS non_conformances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number            VARCHAR(30) UNIQUE NOT NULL,
  inspection_id     UUID REFERENCES inspections(id) ON DELETE SET NULL,
  product_id        UUID REFERENCES products(id),
  severity_id       UUID REFERENCES severities(id),
  title             VARCHAR(255) NOT NULL,
  description       TEXT,
  status            VARCHAR(40) NOT NULL DEFAULT 'open',
  root_cause        TEXT,
  containment       TEXT,
  reported_by       UUID REFERENCES users(id),
  assigned_to       UUID REFERENCES users(id),
  reported_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nc_status ON non_conformances(status);
CREATE INDEX IF NOT EXISTS idx_nc_product ON non_conformances(product_id);
CREATE INDEX IF NOT EXISTS idx_nc_severity ON non_conformances(severity_id);

CREATE OR REPLACE FUNCTION set_nc_number() RETURNS TRIGGER AS $$
DECLARE seq_val BIGINT;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    seq_val := nextval('nc_number_seq');
    NEW.number := 'NC-' || to_char(now(),'YYYY') || '-' || lpad(seq_val::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nc_number ON non_conformances;
CREATE TRIGGER trg_nc_number BEFORE INSERT ON non_conformances
  FOR EACH ROW EXECUTE FUNCTION set_nc_number();

-- ============================================================
-- Corrective actions
-- ============================================================
CREATE TABLE IF NOT EXISTS corrective_actions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  non_conformance_id    UUID NOT NULL REFERENCES non_conformances(id) ON DELETE CASCADE,
  description           TEXT NOT NULL,
  action_type           VARCHAR(40) NOT NULL DEFAULT 'corrective',
  status                VARCHAR(30) NOT NULL DEFAULT 'planned',
  assigned_to           UUID REFERENCES users(id),
  due_date              DATE,
  completed_at          TIMESTAMPTZ,
  verified_at           TIMESTAMPTZ,
  verified_by           UUID REFERENCES users(id),
  effectiveness_note    TEXT,
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ca_nc ON corrective_actions(non_conformance_id);
CREATE INDEX IF NOT EXISTS idx_ca_assigned ON corrective_actions(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ca_status ON corrective_actions(status);
CREATE INDEX IF NOT EXISTS idx_ca_due ON corrective_actions(due_date);

-- ============================================================
-- Audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action       VARCHAR(50) NOT NULL,
  entity_type  VARCHAR(50) NOT NULL,
  entity_id    UUID,
  diff         JSONB,
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_brin ON audit_logs USING BRIN (created_at);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION tg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','profiles','products','inspection_schedules','inspections',
    'non_conformances','corrective_actions'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$s
                    FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();', t);
  END LOOP;
END $$;

-- ============================================================
-- MES extensions: lines, stations, work orders, plans, holds,
-- CAPA, calibration, SPC, suppliers, incoming lots
-- ============================================================
CREATE TABLE IF NOT EXISTS production_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  area VARCHAR(80),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID REFERENCES production_lines(id) ON DELETE SET NULL,
  code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  operation VARCHAR(80),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  contact_email VARCHAR(200),
  contact_phone VARCHAR(50),
  rating NUMERIC(3,2),
  is_approved BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number VARCHAR(40) UNIQUE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  line_id UUID REFERENCES production_lines(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  quantity_completed NUMERIC NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'planned',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  planned_start TIMESTAMPTZ,
  planned_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wo_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  sequence INT NOT NULL DEFAULT 0,
  name VARCHAR(150) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inspection_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  plan_type VARCHAR(30) NOT NULL DEFAULT 'in_process',
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  aql_level VARCHAR(20),
  sample_size_rule VARCHAR(80),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_characteristics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES inspection_plans(id) ON DELETE CASCADE,
  parameter VARCHAR(200) NOT NULL,
  unit_id UUID REFERENCES measurement_units(id),
  min_value NUMERIC,
  max_value NUMERIC,
  target_value NUMERIC,
  method TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS incoming_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_number VARCHAR(80) NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  disposition VARCHAR(30),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(80),
  manufacturer VARCHAR(120),
  serial_number VARCHAR(120),
  resolution NUMERIC,
  range_min NUMERIC,
  range_max NUMERIC,
  location VARCHAR(120),
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  last_cal_date DATE,
  next_cal_date DATE,
  cal_interval_days INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calibration_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gage_id UUID NOT NULL REFERENCES gages(id) ON DELETE CASCADE,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  performed_by UUID REFERENCES users(id),
  result VARCHAR(20) NOT NULL DEFAULT 'pass',
  certificate_url TEXT,
  next_due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS msa_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gage_id UUID NOT NULL REFERENCES gages(id) ON DELETE CASCADE,
  study_type VARCHAR(30) NOT NULL DEFAULT 'gage_rr',
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  performed_by UUID REFERENCES users(id),
  result_percent NUMERIC,
  verdict VARCHAR(20),
  data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quality_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number VARCHAR(40) UNIQUE NOT NULL,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  lot_number VARCHAR(120),
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  quantity NUMERIC,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  disposition VARCHAR(30),
  reason TEXT NOT NULL,
  opened_by UUID REFERENCES users(id),
  closed_by UUID REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capa_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number VARCHAR(40) UNIQUE NOT NULL,
  non_conformance_id UUID REFERENCES non_conformances(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  methodology VARCHAR(20) NOT NULL DEFAULT '8d',
  d1_team TEXT, d2_problem TEXT, d3_containment TEXT,
  d4_root_cause TEXT, d5_corrective TEXT, d6_implementation TEXT,
  d7_prevention TEXT, d8_closure TEXT,
  assigned_to UUID REFERENCES users(id),
  due_date DATE,
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spc_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specification_item_id UUID REFERENCES specification_items(id) ON DELETE SET NULL,
  plan_characteristic_id UUID REFERENCES plan_characteristics(id) ON DELETE SET NULL,
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  inspection_id UUID REFERENCES inspections(id) ON DELETE SET NULL,
  sample_size INT NOT NULL DEFAULT 1,
  mean NUMERIC,
  range_value NUMERIC,
  stddev NUMERIC,
  ucl NUMERIC, lcl NUMERIC, cl NUMERIC,
  usl NUMERIC, lsl NUMERIC,
  cp NUMERIC, cpk NUMERIC,
  out_of_control_rules JSONB,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extend inspections/NCs/measurements with MES links
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS station_id UUID REFERENCES stations(id) ON DELETE SET NULL;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES inspection_plans(id) ON DELETE SET NULL;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS incoming_lot_id UUID REFERENCES incoming_lots(id) ON DELETE SET NULL;
ALTER TABLE non_conformances ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL;
ALTER TABLE non_conformances ADD COLUMN IF NOT EXISTS station_id UUID REFERENCES stations(id) ON DELETE SET NULL;
ALTER TABLE non_conformances ADD COLUMN IF NOT EXISTS hold_id UUID REFERENCES quality_holds(id) ON DELETE SET NULL;
ALTER TABLE non_conformances ADD COLUMN IF NOT EXISTS capa_id UUID REFERENCES capa_records(id) ON DELETE SET NULL;
ALTER TABLE inspection_measurements ADD COLUMN IF NOT EXISTS gage_id UUID REFERENCES gages(id) ON DELETE SET NULL;

CREATE SEQUENCE IF NOT EXISTS wo_number_seq;
CREATE SEQUENCE IF NOT EXISTS hold_number_seq;
CREATE SEQUENCE IF NOT EXISTS capa_number_seq;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'production_lines','stations','suppliers','work_orders','wo_operations',
    'inspection_plans','incoming_lots','gages','quality_holds','capa_records'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$s FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();', t);
  END LOOP;
END $$;
