/**
 * AC-102: requireRoles middleware must return HTTP 403 with the
 * { error: { code, message, details } } envelope for authenticated-but-unauthorised requests.
 *
 * Run with:  cd api && npm run build && node --test dist/tests/auth.test.js
 * (Pure unit test — no database, no server required.)
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { requireRoles } from "../auth";
import { errorHandler, ApiError } from "../errors";

function mkReq(user?: { id: string; email: string; roles: string[] }) {
  return { headers: {}, correlationId: "test-id", user } as unknown as Request & { user?: unknown };
}
function mkRes() {
  const res: any = {};
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  return res as Response & { statusCode?: number; body?: any };
}

test("requireRoles allows a caller with a matching role", () => {
  const req = mkReq({ id: "u1", email: "a@b", roles: ["administrator"] });
  const res = mkRes();
  let calledNext = false;
  requireRoles("administrator", "quality_manager")(req as any, res as any, (err?: unknown) => {
    calledNext = !err;
  });
  assert.equal(calledNext, true);
});

test("requireRoles returns 403 with envelope for authenticated-but-unauthorised caller", () => {
  const req = mkReq({ id: "u2", email: "v@b", roles: ["viewer"] });
  const res = mkRes();
  requireRoles("administrator")(req as any, res as any, (err?: unknown) => {
    // The middleware passes to next(err); simulate express error handler.
    assert.ok(err instanceof ApiError);
    errorHandler(err as any, req as any, res as any, () => {});
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.error?.code, "forbidden");
  assert.equal(typeof res.body?.error?.message, "string");
  // shape: { error: { code, message, details? } }
  assert.ok("error" in res.body);
});

test("requireRoles returns 401 when no user is attached", () => {
  const req = mkReq(undefined);
  const res = mkRes();
  requireRoles("administrator")(req as any, res as any, (err?: unknown) => {
    assert.ok(err instanceof ApiError);
    errorHandler(err as any, req as any, res as any, () => {});
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.error?.code, "unauthorized");
});
