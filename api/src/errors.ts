import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "./logger";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const correlationId = (req as any).correlationId;
  if (err instanceof ZodError) {
    const details = err.issues.map(i => ({ path: i.path.join("."), message: i.message }));
    logger.warn({ correlationId, code: "validation_error", details });
    return res.status(400).json({ error: { code: "validation_error", message: "Invalid input", details } });
  }
  if (err instanceof ApiError) {
    logger.warn({ correlationId, code: err.code, message: err.message });
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  logger.error({ correlationId, err: err?.message, stack: err?.stack });
  res.status(500).json({ error: { code: "internal_error", message: "Internal server error" } });
}
