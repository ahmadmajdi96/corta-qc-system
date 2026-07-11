import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { logger } from "./logger";

export function correlationId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers["x-correlation-id"] as string) ?? randomUUID();
  (req as any).correlationId = id;
  res.setHeader("x-correlation-id", id);
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      correlationId: (req as any).correlationId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
}

export function envelope<T>(data: T, meta?: Record<string, unknown>) {
  return { data, meta: meta ?? {} };
}

export function paginated<T>(data: T[], total: number, page: number, limit: number, nextCursor?: string | null) {
  return { data, meta: { total, page, limit, nextCursor: nextCursor ?? null } };
}

export function parsePage(req: Request): { page: number; limit: number; offset: number } {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 25)));
  return { page, limit, offset: (page - 1) * limit };
}

export function asyncH(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}
