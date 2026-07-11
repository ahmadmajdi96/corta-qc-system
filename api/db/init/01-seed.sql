-- CORTA QC — Seed data: roles, permissions, first admin user, defaults.

INSERT INTO roles(name, description) VALUES
  ('administrator','Full system access'),
  ('quality_manager','Manages products, specs, NCs and CAPA'),
  ('inspector','Executes inspections'),
  ('auditor','Read-only auditor'),
  ('viewer','Read-only viewer')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions(resource, action) VALUES
  ('products','list'),('products','view'),('products','create'),('products','update'),('products','delete'),
  ('specifications','view'),('specifications','create'),('specifications','update'),
  ('inspections','list'),('inspections','view'),('inspections','create'),('inspections','update'),('inspections','execute'),('inspections','cancel'),('inspections','reopen'),
  ('non_conformances','list'),('non_conformances','view'),('non_conformances','create'),('non_conformances','update'),('non_conformances','close'),('non_conformances','delete'),
  ('corrective_actions','list'),('corrective_actions','view'),('corrective_actions','create'),('corrective_actions','update'),('corrective_actions','verify'),('corrective_actions','assign'),
  ('users','list'),('users','create'),('users','update'),('users','assign'),
  ('roles','list'),('roles','manage'),
  ('reports','view'),('reports','export'),
  ('settings','view'),('settings','update')
ON CONFLICT DO NOTHING;

-- administrator gets everything
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'administrator'
ON CONFLICT DO NOTHING;

-- quality_manager: everything except users.create/update and settings.update
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'quality_manager'
  AND NOT (p.resource='users' AND p.action IN ('create','update'))
  AND NOT (p.resource='settings' AND p.action='update')
  AND NOT (p.resource='non_conformances' AND p.action='delete')
ON CONFLICT DO NOTHING;

-- inspector: list/view + execute inspections + raise NCs
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'inspector'
  AND (
    (p.resource='products' AND p.action IN ('list','view')) OR
    (p.resource='specifications' AND p.action='view') OR
    (p.resource='inspections' AND p.action IN ('list','view','execute','update')) OR
    (p.resource='non_conformances' AND p.action IN ('list','view','create')) OR
    (p.resource='corrective_actions' AND p.action IN ('list','view','update'))
  )
ON CONFLICT DO NOTHING;

-- auditor + viewer: read-only
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('auditor','viewer') AND p.action IN ('list','view')
ON CONFLICT DO NOTHING;

INSERT INTO measurement_units(code, label) VALUES
  ('g','Grams'),('kg','Kilograms'),('ml','Milliliters'),('l','Liters'),
  ('c','Celsius'),('ph','pH'),('pct','Percent'),('unit','Unit'),('cfu_g','CFU/g')
ON CONFLICT DO NOTHING;

INSERT INTO severities(code, label, weight, color) VALUES
  ('critical','Critical',3,'#dc2626'),
  ('major','Major',2,'#f97316'),
  ('minor','Minor',1,'#eab308')
ON CONFLICT DO NOTHING;

-- Default admin: admin@corta.local / admin123 (bcrypt hash below)
-- Hash generated for 'admin123' with 10 rounds.
INSERT INTO users(id, email, password_hash, full_name, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@corta.local',
  '$2a$10$N.PmXHhCn6QqxTfPzKZP..Wz9ZLGwYyKm/kAZaBOZFyM6WlYQe2Ie',
  'System Administrator',
  TRUE
) ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles(id, email, full_name, is_active)
VALUES ('00000000-0000-0000-0000-000000000001','admin@corta.local','System Administrator',TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles(user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM roles WHERE name='administrator'
ON CONFLICT DO NOTHING;
