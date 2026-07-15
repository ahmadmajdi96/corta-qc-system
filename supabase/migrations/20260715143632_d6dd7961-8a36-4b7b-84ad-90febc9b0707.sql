
-- RLS role checks
GRANT EXECUTE ON FUNCTION public.has_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(UUID, TEXT[]) TO authenticated;

-- Explicit RPC APIs
GRANT EXECUTE ON FUNCTION public.approve_inspection_plan(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.new_plan_revision(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_overdue_escalations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nc_qty_reconciles(UUID) TO authenticated;
