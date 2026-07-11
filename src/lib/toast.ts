import { toast } from "sonner";

function messageOf(err: unknown, fallback = "Something went wrong"): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || fallback;
  const anyErr = err as { message?: unknown };
  if (typeof anyErr.message === "string" && anyErr.message.length > 0) return anyErr.message;
  return fallback;
}

/**
 * AC-100: ERROR toasts persist until the user dismisses them (duration: Infinity)
 * and always carry a Retry action.
 */
export function notifyError(err: unknown, opts?: { retry?: () => void; fallback?: string }) {
  const msg = messageOf(err, opts?.fallback);
  toast.error(msg, {
    duration: Infinity,
    closeButton: true,
    action: {
      label: "Retry",
      onClick: () => (opts?.retry ? opts.retry() : window.location.reload()),
    },
  });
}

/** AC-100: success toasts auto-dismiss after ~5s. */
export function notifySuccess(msg: string) {
  toast.success(msg, { duration: 5000 });
}

/**
 * AC-101: parse a server error of shape { error: { code: 'VALIDATION', details: [{ path, message }] } }
 * (also tolerates plain Zod issues arrays) into a flat { fieldName: message } map.
 */
export function parseServerFieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const anyErr = err as any;
  const details =
    anyErr?.error?.details ??
    anyErr?.details ??
    anyErr?.response?.data?.error?.details ??
    anyErr?.issues;
  if (Array.isArray(details)) {
    for (const d of details) {
      const path = Array.isArray(d?.path) ? d.path.join(".") : (d?.path ?? d?.field);
      const message = d?.message ?? d?.msg;
      if (path && message) out[String(path)] = String(message);
    }
  }
  return out;
}
