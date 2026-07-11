
-- ============================================================
-- CORTA QC — Complete schema
-- ============================================================

-- Enums / helper
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ ROLES / PERMISSIONS ============
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(80) NOT NULL,
  action VARCHAR(30) NOT NULL,
  UNIQUE(resource, action)
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY(role_id, permission_id)
);
CREATE INDEX ON public.role_permissions(role_id);
CREATE INDEX ON public.role_permissions(permission_id);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, role_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- security-definer role checker (name-based)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.name = _role_name
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _role_names TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.name = ANY(_role_names)
  )
$$;

-- Role/permission read policies (authenticated can read to render menus)
CREATE POLICY "roles readable by authenticated" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions readable by authenticated" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions readable by authenticated" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
-- Only admins can write role/permission mapping
CREATE POLICY "admins manage roles" ON public.roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "admins manage permissions" ON public.permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "admins manage role_permissions" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "admins manage user_roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_email_idx ON public.profiles(email);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "admins update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));
CREATE POLICY "admins insert profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'administrator') OR id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto create profile on signup + assign default viewer role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_role_id UUID;
  is_first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles(id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));

  SELECT NOT EXISTS(SELECT 1 FROM public.user_roles) INTO is_first_user;
  IF is_first_user THEN
    SELECT id INTO default_role_id FROM public.roles WHERE name='administrator';
  ELSE
    SELECT id INTO default_role_id FROM public.roles WHERE name='viewer';
  END IF;
  IF default_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role_id) VALUES (NEW.id, default_role_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PRODUCT CATEGORIES / PRODUCTS ============
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL
);
CREATE INDEX product_categories_parent_idx ON public.product_categories(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories readable" ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "qm/admin manage categories" ON public.product_categories FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']));

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON public.products(category_id);
CREATE INDEX products_name_idx ON public.products(name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products readable" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "qm/admin manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ QUALITY SPECIFICATIONS ============
CREATE TABLE public.quality_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  effective_date DATE,
  UNIQUE(product_id, version)
);
CREATE UNIQUE INDEX quality_specifications_active_idx
  ON public.quality_specifications(product_id) WHERE is_active = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_specifications TO authenticated;
GRANT ALL ON public.quality_specifications TO service_role;
ALTER TABLE public.quality_specifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "specs readable" ON public.quality_specifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "qm/admin manage specs" ON public.quality_specifications FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']));

CREATE TABLE public.specification_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id UUID NOT NULL REFERENCES public.quality_specifications(id) ON DELETE CASCADE,
  sequence INT NOT NULL DEFAULT 1,
  name VARCHAR(200) NOT NULL,
  measurement_type VARCHAR(20) NOT NULL CHECK (measurement_type IN ('numeric','boolean','text','visual')),
  unit VARCHAR(20),
  target_value NUMERIC,
  lower_tolerance NUMERIC,
  upper_tolerance NUMERIC,
  pass_criteria TEXT,
  is_critical BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX specification_items_spec_idx ON public.specification_items(spec_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.specification_items TO authenticated;
GRANT ALL ON public.specification_items TO service_role;
ALTER TABLE public.specification_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spec items readable" ON public.specification_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "qm/admin manage spec items" ON public.specification_items FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']));

-- ============ INSPECTION SCHEDULES ============
CREATE TABLE public.inspection_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  spec_id UUID NOT NULL REFERENCES public.quality_specifications(id) ON DELETE RESTRICT,
  frequency VARCHAR(30) NOT NULL CHECK (frequency IN ('hourly','shift','daily','weekly','custom')),
  custom_cron VARCHAR(100),
  shift_pattern VARCHAR(50),
  assigned_to UUID REFERENCES auth.users(id),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX inspection_schedules_product_idx ON public.inspection_schedules(product_id);
CREATE INDEX inspection_schedules_assigned_idx ON public.inspection_schedules(assigned_to);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_schedules TO authenticated;
GRANT ALL ON public.inspection_schedules TO service_role;
ALTER TABLE public.inspection_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules readable" ON public.inspection_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "qm/admin manage schedules" ON public.inspection_schedules FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']));
CREATE TRIGGER trg_schedules_updated BEFORE UPDATE ON public.inspection_schedules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ INSPECTIONS ============
CREATE TABLE public.inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES public.inspection_schedules(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  spec_id UUID NOT NULL REFERENCES public.quality_specifications(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','cancelled')),
  scheduled_date DATE NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  lot_number VARCHAR(100),
  notes TEXT,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX inspections_schedule_idx ON public.inspections(schedule_id);
CREATE INDEX inspections_product_idx ON public.inspections(product_id);
CREATE INDEX inspections_scheduled_date_idx ON public.inspections(scheduled_date);
CREATE INDEX inspections_status_idx ON public.inspections(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspections TO authenticated;
GRANT ALL ON public.inspections TO service_role;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inspections readable" ON public.inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspectors/qm/admin create inspections" ON public.inspections FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','inspector']));
CREATE POLICY "inspectors update own inspections" ON public.inspections FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager'])
    OR (public.has_role(auth.uid(),'inspector') AND (performed_by = auth.uid() OR performed_by IS NULL))
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager'])
    OR (public.has_role(auth.uid(),'inspector') AND (performed_by = auth.uid() OR performed_by IS NULL))
  );
CREATE POLICY "admin delete inspections" ON public.inspections FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER trg_inspections_updated BEFORE UPDATE ON public.inspections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ MEASUREMENTS ============
CREATE TABLE public.inspection_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  spec_item_id UUID NOT NULL REFERENCES public.specification_items(id) ON DELETE RESTRICT,
  measured_value TEXT,
  is_pass BOOLEAN,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE(inspection_id, spec_item_id)
);
CREATE INDEX measurements_inspection_idx ON public.inspection_measurements(inspection_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_measurements TO authenticated;
GRANT ALL ON public.inspection_measurements TO service_role;
ALTER TABLE public.inspection_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "measurements readable" ON public.inspection_measurements FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspectors record measurements" ON public.inspection_measurements FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','inspector']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','inspector']));

-- ============ NON-CONFORMANCES ============
CREATE TABLE public.non_conformances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number VARCHAR(30) NOT NULL UNIQUE,
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  measurement_id UUID REFERENCES public.inspection_measurements(id) ON DELETE SET NULL,
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('critical','major','minor')),
  category VARCHAR(50),
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_investigation','corrective_action_defined','closed','rejected')),
  raised_by UUID NOT NULL REFERENCES auth.users(id),
  raised_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  root_cause TEXT,
  containment TEXT,
  rejection_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX nc_inspection_idx ON public.non_conformances(inspection_id);
CREATE INDEX nc_status_idx ON public.non_conformances(status);
CREATE INDEX nc_severity_idx ON public.non_conformances(severity);
CREATE INDEX nc_raised_by_idx ON public.non_conformances(raised_by);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.non_conformances TO authenticated;
GRANT ALL ON public.non_conformances TO service_role;
ALTER TABLE public.non_conformances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nc readable" ON public.non_conformances FOR SELECT TO authenticated USING (true);
CREATE POLICY "inspectors raise nc" ON public.non_conformances FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','inspector']));
CREATE POLICY "qm/admin update nc" ON public.non_conformances FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']));
CREATE POLICY "admin delete nc" ON public.non_conformances FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'administrator'));
CREATE TRIGGER trg_nc_updated BEFORE UPDATE ON public.non_conformances
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Sequence & auto-number for NC
CREATE SEQUENCE IF NOT EXISTS public.nc_number_seq;
CREATE OR REPLACE FUNCTION public.set_nc_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE seq_val BIGINT;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    seq_val := nextval('public.nc_number_seq');
    NEW.number := 'NC-' || to_char(now(),'YYYY') || '-' || lpad(seq_val::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_nc_number BEFORE INSERT ON public.non_conformances
  FOR EACH ROW EXECUTE FUNCTION public.set_nc_number();

-- ============ CORRECTIVE ACTIONS ============
CREATE TABLE public.corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  non_conformance_id UUID NOT NULL REFERENCES public.non_conformances(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assigned_to UUID REFERENCES auth.users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','verified')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ca_nc_idx ON public.corrective_actions(non_conformance_id);
CREATE INDEX ca_assigned_idx ON public.corrective_actions(assigned_to);
CREATE INDEX ca_status_idx ON public.corrective_actions(status);
CREATE INDEX ca_due_date_idx ON public.corrective_actions(due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corrective_actions TO authenticated;
GRANT ALL ON public.corrective_actions TO service_role;
ALTER TABLE public.corrective_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca readable" ON public.corrective_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "qm/admin manage ca" ON public.corrective_actions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager']));
CREATE POLICY "assignee updates own ca" ON public.corrective_actions FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid()) WITH CHECK (assigned_to = auth.uid());
CREATE TRIGGER trg_ca_updated BEFORE UPDATE ON public.corrective_actions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs(entity_type, entity_id);
CREATE INDEX audit_logs_created_brin ON public.audit_logs USING BRIN(created_at);
CREATE INDEX audit_logs_user_idx ON public.audit_logs(user_id);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.audit_logs_id_seq TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read audit" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert audit" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ============ REFERENCE DATA ============
CREATE TABLE public.measurement_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  label VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.measurement_units TO authenticated;
GRANT ALL ON public.measurement_units TO service_role;
ALTER TABLE public.measurement_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "units readable" ON public.measurement_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage units" ON public.measurement_units FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

CREATE TABLE public.severities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  label VARCHAR(50) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#888888',
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.severities TO authenticated;
GRANT ALL ON public.severities TO service_role;
ALTER TABLE public.severities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "severities readable" ON public.severities FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage severities" ON public.severities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrator')) WITH CHECK (public.has_role(auth.uid(),'administrator'));

-- ============ SEED DATA ============
INSERT INTO public.roles(name, description) VALUES
  ('administrator','System administrator'),
  ('quality_manager','Owns the quality programme'),
  ('inspector','Performs inspections on the floor'),
  ('auditor','Read-only historical review'),
  ('viewer','Read-only dashboards');

-- Permissions catalogue
INSERT INTO public.permissions(resource, action) VALUES
  ('product','create'),('product','read'),('product','update'),('product','delete'),('product','list'),
  ('specification','create'),('specification','read'),('specification','update'),('specification','delete'),
  ('inspection','create'),('inspection','read'),('inspection','update'),('inspection','delete'),('inspection','list'),
  ('measurement','create'),('measurement','update'),
  ('non_conformance','create'),('non_conformance','read'),('non_conformance','update'),('non_conformance','delete'),
  ('corrective_action','create'),('corrective_action','read'),('corrective_action','update'),('corrective_action','assign'),
  ('user','create'),('user','read'),('user','update'),('user','delete'),
  ('role','create'),('role','read'),('role','update'),
  ('settings','read'),('settings','update'),
  ('report','read'),
  ('audit','read');

-- Assign permissions to roles
-- admin: all
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p WHERE r.name='administrator';
-- quality_manager: everything except user/role admin
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name='quality_manager' AND p.resource NOT IN ('user','role','settings');
-- inspector: read products/specs, create/update inspections, measurements, raise NC
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name='inspector' AND (
  (p.resource='product' AND p.action IN ('read','list'))
  OR (p.resource='specification' AND p.action='read')
  OR (p.resource='inspection' AND p.action IN ('create','read','update','list'))
  OR (p.resource='measurement')
  OR (p.resource='non_conformance' AND p.action IN ('create','read'))
  OR (p.resource='corrective_action' AND p.action IN ('read','update'))
  OR (p.resource='report' AND p.action='read')
);
-- auditor: read everything + audit
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name='auditor' AND (p.action IN ('read','list') OR p.resource='audit');
-- viewer: read reports/dashboards/inspections only
INSERT INTO public.role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name='viewer' AND (
  p.action IN ('read','list')
  AND p.resource IN ('product','inspection','non_conformance','corrective_action','report')
);

-- Seed reference data
INSERT INTO public.measurement_units(code, label) VALUES
  ('°C','Degrees Celsius'),('°F','Degrees Fahrenheit'),('pH','pH'),('%','Percent'),
  ('g','Grams'),('kg','Kilograms'),('mL','Millilitres'),('L','Litres'),
  ('ppm','Parts per million'),('cm','Centimetres'),('mm','Millimetres'),('unit','Unit count');

INSERT INTO public.severities(code, label, color, sort_order) VALUES
  ('critical','Critical','#dc2626',1),
  ('major','Major','#ea580c',2),
  ('minor','Minor','#eab308',3);

-- Seed a couple of product categories
INSERT INTO public.product_categories(name) VALUES ('Bakery'),('Dairy'),('Beverage'),('Meat & Poultry');
