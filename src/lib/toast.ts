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
 * Universal error toast — auto-dismisses after ~5s and ALWAYS carries a Retry action.
 * If a `retry` callback is supplied it is re-invoked on click; otherwise Retry reloads the page.
 * Route every error toast through this so AC-101 (auto-dismiss + retry) holds app-wide.
 */
export function notifyError(err: unknown, opts?: { retry?: () => void; fallback?: string }) {
  const msg = messageOf(err, opts?.fallback);
  notifyError(msg, {
    duration: 5000,
    action: {
      label: "Retry",
      onClick: () => (opts?.retry ? opts.retry() : window.location.reload()),
    },
  });
}

export function notifySuccess(msg: string) {
  toast.success(msg, { duration: 5000 });
}
