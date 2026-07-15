
-- Tighten notif insert: allow authenticated users who set themselves as sender or admins
DROP POLICY IF EXISTS notif_insert ON public.notifications;
CREATE POLICY notif_insert ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    -- self-notifications OR quality roles creating notifications for others
    recipient_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer'])
  );

-- Tighten gauge_usage_history insert: must reference an existing gage row
DROP POLICY IF EXISTS guh_insert ON public.gauge_usage_history;
CREATE POLICY guh_insert ON public.gauge_usage_history FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.gages g WHERE g.id = gage_id)
    AND (used_by IS NULL OR used_by = auth.uid())
  );

-- Restrict SECURITY DEFINER helper to authenticated users
REVOKE EXECUTE ON FUNCTION public.nc_qty_reconciles(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nc_qty_reconciles(UUID) TO authenticated, service_role;
