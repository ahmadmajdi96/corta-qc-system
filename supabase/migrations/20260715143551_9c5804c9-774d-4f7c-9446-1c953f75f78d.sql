
ALTER VIEW public.qms_kpi_summary SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.notify(UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_role(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.run_overdue_escalations() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_inspection_plan(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.new_plan_revision(UUID) FROM PUBLIC, anon;
