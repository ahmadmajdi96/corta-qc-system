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
