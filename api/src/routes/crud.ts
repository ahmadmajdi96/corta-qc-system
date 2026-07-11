import { Router } from "express";
import { z } from "zod";
import { q, q1 } from "../db";
import { requireAuth, requireRoles } from "../auth";
import { asyncH, envelope, paginated, parsePage } from "../util";
import { ApiError } from "../errors";

export const apiRouter = Router();
apiRouter.use(requireAuth);

// ------------------- Products -------------------
apiRouter.get("/products", asyncH(async (req, res) => {
  const { page, limit, offset } = parsePage(req);
  const search = String(req.query.search ?? "").trim();
  const category = req.query.category_id ? String(req.query.category_id) : null;
  const params: any[] = []; const where: string[] = [];
  if (search) { params.push(`%${search}%`); where.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`); }
  if (category) { params.push(category); where.push(`p.category_id=$${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q1<{c:string}>(`SELECT COUNT(*)::int as c FROM products p ${w}`, params);
  params.push(limit); params.push(offset);
  const rows = await q(`SELECT p.*, c.name AS category_name FROM products p LEFT JOIN product_categories c ON c.id=p.category_id ${w} ORDER BY p.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
  res.json(paginated(rows, Number(totalRow?.c ?? 0), page, limit));
}));

const productSchema = z.object({
  sku: z.string().min(1), name: z.string().min(1),
  description: z.string().optional(), category_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
});
apiRouter.post("/products", requireRoles("administrator","quality_manager"), asyncH(async (req, res) => {
  const p = productSchema.parse(req.body);
  const row = await q1(`INSERT INTO products(sku,name,description,category_id,is_active) VALUES($1,$2,$3,$4,COALESCE($5,TRUE)) RETURNING *`,
    [p.sku,p.name,p.description??null,p.category_id??null,p.is_active]);
  res.status(201).json(envelope(row));
}));
apiRouter.get("/products/:id", asyncH(async (req, res) => {
  const row = await q1(`SELECT * FROM products WHERE id=$1`, [req.params.id]);
  if (!row) throw new ApiError("not_found","Product not found",404);
  res.json(envelope(row));
}));
apiRouter.patch("/products/:id", requireRoles("administrator","quality_manager"), asyncH(async (req, res) => {
  const p = productSchema.partial().parse(req.body);
  const fields = Object.entries(p).filter(([,v])=>v!==undefined);
  if (!fields.length) return res.json(envelope(await q1(`SELECT * FROM products WHERE id=$1`, [req.params.id])));
  const sets = fields.map(([k],i)=>`${k}=$${i+1}`).join(", ");
  const vals = fields.map(([,v])=>v); vals.push(req.params.id);
  const row = await q1(`UPDATE products SET ${sets} WHERE id=$${vals.length} RETURNING *`, vals);
  res.json(envelope(row));
}));
apiRouter.delete("/products/:id", requireRoles("administrator"), asyncH(async (req, res) => {
  await q(`DELETE FROM products WHERE id=$1`, [req.params.id]);
  res.json(envelope({ ok: true }));
}));

// ------------------- Categories -------------------
apiRouter.get("/product-categories", asyncH(async (_req, res) => {
  const rows = await q(`SELECT * FROM product_categories ORDER BY name`);
  res.json(envelope(rows));
}));

// ------------------- Inspections -------------------
apiRouter.get("/inspections", asyncH(async (req, res) => {
  const { page, limit, offset } = parsePage(req);
  const status = req.query.status ? String(req.query.status) : null;
  const productId = req.query.product_id ? String(req.query.product_id) : null;
  const lot = req.query.lot ? String(req.query.lot) : null;
  const from = req.query.from ? String(req.query.from) : null;
  const to = req.query.to ? String(req.query.to) : null;
  const params: any[] = []; const where: string[] = [];
  if (status) { params.push(status); where.push(`i.status=$${params.length}`); }
  if (productId) { params.push(productId); where.push(`i.product_id=$${params.length}`); }
  if (lot) { params.push(`%${lot}%`); where.push(`i.lot_number ILIKE $${params.length}`); }
  if (from) { params.push(from); where.push(`i.scheduled_for >= $${params.length}`); }
  if (to) { params.push(to); where.push(`i.scheduled_for <= $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = await q1<{c:number}>(`SELECT COUNT(*)::int c FROM inspections i ${w}`, params);
  params.push(limit); params.push(offset);
  const rows = await q(`SELECT i.*, p.name AS product_name, p.sku AS product_sku FROM inspections i JOIN products p ON p.id=i.product_id ${w} ORDER BY i.scheduled_for DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
  res.json(paginated(rows, Number(total?.c ?? 0), page, limit));
}));

const inspectionCreate = z.object({
  product_id: z.string().uuid(), specification_id: z.string().uuid().optional(),
  scheduled_for: z.string(), lot_number: z.string().optional(),
  inspector_id: z.string().uuid().optional(), notes: z.string().optional(),
});
apiRouter.post("/inspections", requireRoles("administrator","quality_manager","inspector"), asyncH(async (req, res) => {
  const u = (req as any).user;
  const p = inspectionCreate.parse(req.body);
  const row = await q1(`INSERT INTO inspections(product_id,specification_id,scheduled_for,lot_number,inspector_id,notes,created_by,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,'planned') RETURNING *`,
    [p.product_id,p.specification_id??null,p.scheduled_for,p.lot_number??null,p.inspector_id??u.id,p.notes??null,u.id]);
  res.status(201).json(envelope(row));
}));

apiRouter.get("/inspections/:id", asyncH(async (req, res) => {
  const row = await q1(`SELECT * FROM inspections WHERE id=$1`, [req.params.id]);
  if (!row) throw new ApiError("not_found","Inspection not found",404);
  const measurements = await q(`SELECT m.*, si.parameter, si.min_value, si.max_value, si.is_required FROM inspection_measurements m JOIN specification_items si ON si.id=m.specification_item_id WHERE m.inspection_id=$1`, [req.params.id]);
  res.json(envelope({ ...(row as any), measurements }));
}));

const transitionSchema = z.object({ action: z.enum(["start","complete","cancel","reopen"]), reason: z.string().optional() });
apiRouter.post("/inspections/:id/transition", asyncH(async (req, res) => {
  const u = (req as any).user;
  const { action, reason } = transitionSchema.parse(req.body);
  const cur = await q1<{status:string}>(`SELECT status FROM inspections WHERE id=$1`, [req.params.id]);
  if (!cur) throw new ApiError("not_found","Inspection not found",404);
  let sql = "";
  if (action === "start") sql = `UPDATE inspections SET status='in_progress', started_at=now() WHERE id=$1 RETURNING *`;
  else if (action === "complete") sql = `UPDATE inspections SET status='completed', completed_at=now() WHERE id=$1 RETURNING *`;
  else if (action === "cancel") sql = `UPDATE inspections SET status='cancelled', cancelled_at=now(), cancel_reason=$2 WHERE id=$1 RETURNING *`;
  else {
    if (!u.roles.includes("administrator")) throw new ApiError("forbidden","Only administrators can reopen",403);
    sql = `UPDATE inspections SET status='in_progress', completed_at=NULL, cancelled_at=NULL WHERE id=$1 RETURNING *`;
  }
  const args = action === "cancel" ? [req.params.id, reason ?? null] : [req.params.id];
  const row = await q1(sql, args);
  res.json(envelope(row));
}));

// Measurements
const measurementSchema = z.object({
  specification_item_id: z.string().uuid(),
  value_numeric: z.number().nullable().optional(),
  value_text: z.string().nullable().optional(),
  is_pass: z.boolean().nullable().optional(),
  is_na: z.boolean().optional(),
  attachment_url: z.string().url().nullable().optional(),
  note: z.string().nullable().optional(),
});
apiRouter.post("/inspections/:id/measurements", asyncH(async (req, res) => {
  const m = measurementSchema.parse(req.body);
  const row = await q1(`INSERT INTO inspection_measurements(inspection_id,specification_item_id,value_numeric,value_text,is_pass,is_na,attachment_url,note)
    VALUES($1,$2,$3,$4,$5,COALESCE($6,FALSE),$7,$8) RETURNING *`,
    [req.params.id,m.specification_item_id,m.value_numeric??null,m.value_text??null,m.is_pass??null,m.is_na,m.attachment_url??null,m.note??null]);
  res.status(201).json(envelope(row));
}));

// ------------------- Non-conformances -------------------
apiRouter.get("/non-conformances", asyncH(async (req, res) => {
  const { page, limit, offset } = parsePage(req);
  const status = req.query.status ? String(req.query.status) : null;
  const productId = req.query.product_id ? String(req.query.product_id) : null;
  const params: any[] = []; const where: string[] = [];
  if (status) { params.push(status); where.push(`status=$${params.length}`); }
  if (productId) { params.push(productId); where.push(`product_id=$${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = await q1<{c:number}>(`SELECT COUNT(*)::int c FROM non_conformances ${w}`, params);
  params.push(limit); params.push(offset);
  const rows = await q(`SELECT * FROM non_conformances ${w} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
  res.json(paginated(rows, Number(total?.c ?? 0), page, limit));
}));

const ncCreate = z.object({
  title: z.string().min(1), description: z.string().optional(),
  product_id: z.string().uuid().optional(), inspection_id: z.string().uuid().optional(),
  severity_id: z.string().uuid().optional(), assigned_to: z.string().uuid().optional(),
});
apiRouter.post("/non-conformances", asyncH(async (req, res) => {
  const u = (req as any).user;
  const p = ncCreate.parse(req.body);
  const row = await q1(`INSERT INTO non_conformances(title,description,product_id,inspection_id,severity_id,assigned_to,reported_by)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [p.title,p.description??null,p.product_id??null,p.inspection_id??null,p.severity_id??null,p.assigned_to??null,u.id]);
  res.status(201).json(envelope(row));
}));

apiRouter.patch("/non-conformances/:id", asyncH(async (req, res) => {
  const schema = z.object({
    status: z.string().optional(), root_cause: z.string().optional(),
    containment: z.string().optional(), assigned_to: z.string().uuid().nullable().optional(),
    severity_id: z.string().uuid().optional(),
  });
  const p = schema.parse(req.body);
  // If closing, enforce all CAs verified
  if (p.status === "closed") {
    const open = await q1<{c:number}>(
      `SELECT COUNT(*)::int c FROM corrective_actions WHERE non_conformance_id=$1 AND status<>'verified'`, [req.params.id]);
    if (Number(open?.c ?? 0) > 0) throw new ApiError("cannot_close","All corrective actions must be verified before closing",400);
  }
  const fields = Object.entries(p).filter(([,v])=>v!==undefined);
  if (!fields.length) return res.json(envelope(await q1(`SELECT * FROM non_conformances WHERE id=$1`, [req.params.id])));
  const sets = fields.map(([k],i)=>`${k}=$${i+1}`).join(", ");
  const vals = fields.map(([,v])=>v); vals.push(req.params.id);
  const closedAtSet = p.status === "closed" ? `, closed_at=now()` : "";
  const row = await q1(`UPDATE non_conformances SET ${sets}${closedAtSet} WHERE id=$${vals.length} RETURNING *`, vals);
  res.json(envelope(row));
}));

apiRouter.delete("/non-conformances/:id", requireRoles("administrator"), asyncH(async (req, res) => {
  await q(`DELETE FROM non_conformances WHERE id=$1`, [req.params.id]);
  res.json(envelope({ ok: true }));
}));

// ------------------- Corrective actions -------------------
apiRouter.get("/corrective-actions", asyncH(async (req, res) => {
  const { page, limit, offset } = parsePage(req);
  const mine = req.query.mine === "1";
  const params: any[] = [];
  let where = "";
  if (mine) { params.push((req as any).user.id); where = `WHERE assigned_to=$${params.length}`; }
  const total = await q1<{c:number}>(`SELECT COUNT(*)::int c FROM corrective_actions ${where}`, params);
  params.push(limit); params.push(offset);
  const rows = await q(`SELECT * FROM corrective_actions ${where} ORDER BY due_date NULLS LAST, created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
  res.json(paginated(rows, Number(total?.c ?? 0), page, limit));
}));

const caCreate = z.object({
  non_conformance_id: z.string().uuid(),
  description: z.string().min(1),
  action_type: z.string().default("corrective"),
  assigned_to: z.string().uuid().optional(),
  due_date: z.string().optional(),
});
apiRouter.post("/corrective-actions", asyncH(async (req, res) => {
  const u = (req as any).user;
  const p = caCreate.parse(req.body);
  const row = await q1(`INSERT INTO corrective_actions(non_conformance_id,description,action_type,assigned_to,due_date,created_by)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [p.non_conformance_id,p.description,p.action_type,p.assigned_to??null,p.due_date??null,u.id]);
  res.status(201).json(envelope(row));
}));

apiRouter.patch("/corrective-actions/:id", asyncH(async (req, res) => {
  const schema = z.object({
    status: z.string().optional(), assigned_to: z.string().uuid().nullable().optional(),
    due_date: z.string().nullable().optional(), effectiveness_note: z.string().optional(),
  });
  const p = schema.parse(req.body);
  const fields = Object.entries(p).filter(([,v])=>v!==undefined);
  if (!fields.length) return res.json(envelope(await q1(`SELECT * FROM corrective_actions WHERE id=$1`, [req.params.id])));
  const sets = fields.map(([k],i)=>`${k}=$${i+1}`).join(", ");
  const vals = fields.map(([,v])=>v); vals.push(req.params.id);
  const extra = p.status === "verified" ? `, verified_at=now(), verified_by='${(req as any).user.id}'` : "";
  const row = await q1(`UPDATE corrective_actions SET ${sets}${extra} WHERE id=$${vals.length} RETURNING *`, vals);
  res.json(envelope(row));
}));

// ------------------- Users (admin) -------------------
apiRouter.get("/users", requireRoles("administrator"), asyncH(async (req, res) => {
  const { page, limit, offset } = parsePage(req);
  const search = String(req.query.search ?? "").trim();
  const params: any[] = []; let where = "";
  if (search) { params.push(`%${search}%`); where = `WHERE email ILIKE $${params.length} OR full_name ILIKE $${params.length}`; }
  const total = await q1<{c:number}>(`SELECT COUNT(*)::int c FROM users ${where}`, params);
  params.push(limit); params.push(offset);
  const rows = await q(`SELECT id,email,full_name,is_active,last_login_at,created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
  res.json(paginated(rows, Number(total?.c ?? 0), page, limit));
}));

const createUserSchema = z.object({
  email: z.string().email(), password: z.string().min(8),
  full_name: z.string().min(1), roles: z.array(z.string()).default([]),
});
apiRouter.post("/users", requireRoles("administrator"), asyncH(async (req, res) => {
  const p = createUserSchema.parse(req.body);
  const { hashPassword } = await import("../auth");
  const hash = await hashPassword(p.password);
  const user = await q1<{id:string}>(`INSERT INTO users(email,password_hash,full_name) VALUES($1,$2,$3) RETURNING id`, [p.email,hash,p.full_name]);
  await q(`INSERT INTO profiles(id,email,full_name) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [user!.id,p.email,p.full_name]);
  for (const r of p.roles) await q(`INSERT INTO user_roles(user_id,role_id) SELECT $1, id FROM roles WHERE name=$2 ON CONFLICT DO NOTHING`, [user!.id, r]);
  res.status(201).json(envelope({ id: user!.id }));
}));

apiRouter.patch("/users/:id", requireRoles("administrator"), asyncH(async (req, res) => {
  const schema = z.object({ is_active: z.boolean().optional(), full_name: z.string().optional() });
  const p = schema.parse(req.body);
  const fields = Object.entries(p).filter(([,v])=>v!==undefined);
  if (!fields.length) return res.json(envelope({ ok: true }));
  const sets = fields.map(([k],i)=>`${k}=$${i+1}`).join(", ");
  const vals = fields.map(([,v])=>v); vals.push(req.params.id);
  await q(`UPDATE users SET ${sets} WHERE id=$${vals.length}`, vals);
  res.json(envelope({ ok: true }));
}));

apiRouter.post("/users/:id/roles", requireRoles("administrator"), asyncH(async (req, res) => {
  const schema = z.object({ role: z.string() });
  const { role } = schema.parse(req.body);
  await q(`INSERT INTO user_roles(user_id,role_id) SELECT $1, id FROM roles WHERE name=$2 ON CONFLICT DO NOTHING`, [req.params.id, role]);
  res.json(envelope({ ok: true }));
}));

apiRouter.delete("/users/:id/roles/:role", requireRoles("administrator"), asyncH(async (req, res) => {
  await q(`DELETE FROM user_roles WHERE user_id=$1 AND role_id=(SELECT id FROM roles WHERE name=$2)`, [req.params.id, req.params.role]);
  res.json(envelope({ ok: true }));
}));

// ------------------- Roles / permissions -------------------
apiRouter.get("/roles", asyncH(async (_req, res) => {
  const roles = await q(`SELECT * FROM roles ORDER BY name`);
  const perms = await q(`SELECT * FROM permissions ORDER BY resource, action`);
  const rp = await q(`SELECT role_id, permission_id FROM role_permissions`);
  res.json(envelope({ roles, permissions: perms, role_permissions: rp }));
}));

apiRouter.post("/roles", requireRoles("administrator"), asyncH(async (req, res) => {
  const { name, description } = z.object({ name: z.string().min(1), description: z.string().optional() }).parse(req.body);
  const row = await q1(`INSERT INTO roles(name,description) VALUES($1,$2) RETURNING *`, [name, description ?? null]);
  res.status(201).json(envelope(row));
}));

apiRouter.put("/roles/:id/permissions", requireRoles("administrator"), asyncH(async (req, res) => {
  const { permission_ids } = z.object({ permission_ids: z.array(z.string().uuid()) }).parse(req.body);
  await q(`DELETE FROM role_permissions WHERE role_id=$1`, [req.params.id]);
  for (const pid of permission_ids) {
    await q(`INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, pid]);
  }
  res.json(envelope({ ok: true }));
}));

// ------------------- Settings -------------------
apiRouter.get("/settings/units", asyncH(async (_req, res) => res.json(envelope(await q(`SELECT * FROM measurement_units ORDER BY code`)))));
apiRouter.get("/settings/severities", asyncH(async (_req, res) => res.json(envelope(await q(`SELECT * FROM severities ORDER BY weight DESC`)))));

// ------------------- Dashboard -------------------
apiRouter.get("/dashboard/summary", asyncH(async (_req, res) => {
  const [inspOpen, inspToday, ncOpen, caOverdue] = await Promise.all([
    q1<{c:number}>(`SELECT COUNT(*)::int c FROM inspections WHERE status IN ('planned','in_progress')`),
    q1<{c:number}>(`SELECT COUNT(*)::int c FROM inspections WHERE scheduled_for::date = now()::date`),
    q1<{c:number}>(`SELECT COUNT(*)::int c FROM non_conformances WHERE status NOT IN ('closed','rejected')`),
    q1<{c:number}>(`SELECT COUNT(*)::int c FROM corrective_actions WHERE status<>'verified' AND due_date < now()::date`),
  ]);
  res.json(envelope({
    open_inspections: Number(inspOpen?.c ?? 0),
    today_inspections: Number(inspToday?.c ?? 0),
    open_ncs: Number(ncOpen?.c ?? 0),
    overdue_cas: Number(caOverdue?.c ?? 0),
  }));
}));

// ------------------- Reports -------------------
apiRouter.get("/reports/inspection-trends", asyncH(async (_req, res) => {
  const rows = await q(`SELECT date_trunc('day', scheduled_for)::date AS day, status, COUNT(*)::int c FROM inspections WHERE scheduled_for > now() - interval '90 days' GROUP BY 1,2 ORDER BY 1`);
  res.json(envelope(rows));
}));
apiRouter.get("/reports/nc-analysis", asyncH(async (_req, res) => {
  const rows = await q(`SELECT s.label AS severity, COUNT(*)::int c FROM non_conformances n LEFT JOIN severities s ON s.id=n.severity_id GROUP BY 1`);
  res.json(envelope(rows));
}));
apiRouter.get("/reports/capa-effectiveness", asyncH(async (_req, res) => {
  const rows = await q(`SELECT status, COUNT(*)::int c FROM corrective_actions GROUP BY 1`);
  res.json(envelope(rows));
}));

// ------------------- Exports -------------------
apiRouter.get("/exports/:type", asyncH(async (req, res) => {
  const type = req.params.type;
  let rows: any[] = [];
  if (type === "inspections") rows = await q(`SELECT * FROM inspections ORDER BY created_at DESC LIMIT 5000`);
  else if (type === "non-conformances") rows = await q(`SELECT * FROM non_conformances ORDER BY created_at DESC LIMIT 5000`);
  else if (type === "corrective-actions") rows = await q(`SELECT * FROM corrective_actions ORDER BY created_at DESC LIMIT 5000`);
  else throw new ApiError("unknown_export","Unknown export type",400);
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
  res.setHeader("Content-Type","text/csv");
  res.setHeader("Content-Disposition",`attachment; filename="${type}.csv"`);
  res.send(csv);
}));

// ------------------- Audit -------------------
apiRouter.get("/audit-logs", requireRoles("administrator","auditor"), asyncH(async (req, res) => {
  const { page, limit, offset } = parsePage(req);
  const rows = await q(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT $1 OFFSET $2`, [limit, offset]);
  const total = await q1<{c:number}>(`SELECT COUNT(*)::int c FROM audit_logs`);
  res.json(paginated(rows, Number(total?.c ?? 0), page, limit));
}));
