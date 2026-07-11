import { Router } from "express";
import { z } from "zod";
import { q, q1 } from "../db";
import { hashPassword, verifyPassword, signAccess, signRefresh, verifyRefresh, loadUserRoles, requireAuth } from "../auth";
import { ApiError } from "../errors";
import { asyncH, envelope } from "../util";

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post("/login", asyncH(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await q1<{id:string;email:string;password_hash:string;is_active:boolean;full_name:string}>(
    `SELECT id,email,password_hash,is_active,full_name FROM users WHERE email=$1`, [email]);
  if (!user || !user.is_active) throw new ApiError("invalid_credentials","Invalid email or password",401);
  if (!(await verifyPassword(password, user.password_hash))) throw new ApiError("invalid_credentials","Invalid email or password",401);
  const roles = await loadUserRoles(user.id);
  await q(`UPDATE users SET last_login_at=now() WHERE id=$1`, [user.id]);
  res.json(envelope({
    accessToken: signAccess(user.id, roles),
    refreshToken: signRefresh(user.id),
    user: { id: user.id, email: user.email, fullName: user.full_name, roles },
  }));
}));

const refreshSchema = z.object({ refreshToken: z.string().min(1) });
authRouter.post("/refresh", asyncH(async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const userId = verifyRefresh(refreshToken);
  const roles = await loadUserRoles(userId);
  res.json(envelope({ accessToken: signAccess(userId, roles), refreshToken: signRefresh(userId) }));
}));

authRouter.post("/logout", requireAuth, (_req, res) => res.json(envelope({ ok: true })));

authRouter.get("/me", requireAuth, asyncH(async (req, res) => {
  const u = (req as any).user;
  const profile = await q1(`SELECT id,email,full_name,avatar_url,is_active FROM users WHERE id=$1`, [u.id]);
  res.json(envelope({ ...profile, roles: u.roles }));
}));

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
});
authRouter.post("/register", asyncH(async (req, res) => {
  const { email, password, fullName } = registerSchema.parse(req.body);
  const exists = await q1(`SELECT id FROM users WHERE email=$1`, [email]);
  if (exists) throw new ApiError("email_taken","Email already registered",409);
  const hash = await hashPassword(password);
  const isFirst = !(await q1(`SELECT 1 FROM users LIMIT 1`));
  const user = await q1<{id:string}>(
    `INSERT INTO users(email,password_hash,full_name) VALUES($1,$2,$3) RETURNING id`,
    [email, hash, fullName]);
  await q(`INSERT INTO profiles(id,email,full_name) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING`,
    [user!.id, email, fullName]);
  const roleName = isFirst ? "administrator" : "viewer";
  await q(`INSERT INTO user_roles(user_id, role_id) SELECT $1, id FROM roles WHERE name=$2`, [user!.id, roleName]);
  const roles = [roleName];
  res.status(201).json(envelope({
    accessToken: signAccess(user!.id, roles),
    refreshToken: signRefresh(user!.id),
    user: { id: user!.id, email, fullName, roles },
  }));
}));
