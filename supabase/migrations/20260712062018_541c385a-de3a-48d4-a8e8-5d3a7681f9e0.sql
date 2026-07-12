
DROP POLICY IF EXISTS "Requester or QC can update" ON public.requests;
CREATE POLICY "Requester or QC can update" ON public.requests
  FOR UPDATE TO authenticated
  USING (
    requester_id = auth.uid()
    OR assignee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer'])
  )
  WITH CHECK (
    requester_id = auth.uid()
    OR assignee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer'])
  );
