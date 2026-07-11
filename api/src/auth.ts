import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { q, q1 } from "./db";
import { ApiError } from "./errors";

const ACCESS_SECRET = process.env.JWT_SECRET ?? "dev-access";
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET ?? "dev-refresh";
const ACCESS_EXPIRY = process.env.JWT_EXPIRY ?? "24h";
const REFRESH_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY ?? "7d";

export function hashPassword(p: string) { return bcrypt.hash(p, 10); }
export function verifyPassword(p: string, h: string) { return bcrypt.compare(p, h); }

export function signAccess(userId: string, roles: string[]) {
  return jwt.sign({ sub: userId, roles }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY } as jwt.SignOptions);
}
export function signRefresh(userId: string) {
  return jwt.sign({ sub: userId, type: "refresh" }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY } as jwt.SignOptions);
}

export interface AuthUser { id: string; email: string; roles: string[]; }

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) throw new ApiError("unauthorized","Missing bearer token",401);
    const token = h.slice(7);
    const payload = jwt.verify(token, ACCESS_SECRET) as any;
    const user = await q1<{id:string;email:string}>(`SELECT id,email FROM users WHERE id=$1 AND is_active=TRUE`, [payload.sub]);
    if (!user) throw new ApiError("unauthorized","User not found or inactive",401);
    (req as any).user = { id: user.id, email: user.email, roles: payload.roles ?? [] } as AuthUser;
    next();
  } catch (e:any) {
    if (e instanceof ApiError) return next(e);
    next(new ApiError("unauthorized","Invalid or expired token",401));
  }
}

export function requireRoles(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const u = (req as any).user as AuthUser | undefined;
    if (!u) return next(new ApiError("unauthorized","Missing auth",401));
    if (!u.roles.some(r => roles.includes(r))) return next(new ApiError("forbidden","Insufficient role",403));
    next();
  };
}

export async function loadUserRoles(userId: string): Promise<string[]> {
  const rows = await q<{name:string}>(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1`, [userId]);
  return rows.map(r => r.name);
}

export function verifyRefresh(token: string): string {
  const payload = jwt.verify(token, REFRESH_SECRET) as any;
  if (payload.type !== "refresh") throw new ApiError("invalid_token","Not a refresh token",401);
  return payload.sub;
}

export { bcrypt };
