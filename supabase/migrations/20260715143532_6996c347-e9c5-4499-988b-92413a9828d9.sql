
-- Customer complaints
CREATE TABLE IF NOT EXISTS public.customer_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT UNIQUE,
  customer_name TEXT NOT NULL,
  customer_ref TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  lot_number TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  description TEXT NOT NULL,
  containment TEXT,
  root_cause TEXT,
  response_due_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  linked_nc_id UUID REFERENCES public.non_conformances(id) ON DELETE SET NULL,
  linked_capa_id UUID REFERENCES public.capa_records(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_complaints TO authenticated;
GRANT ALL ON public.customer_complaints TO service_role;
ALTER TABLE public.customer_complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read complaints" ON public.customer_complaints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Quality manage complaints" ON public.customer_complaints FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','quality_engineer']));
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.customer_complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_received ON public.customer_complaints(received_at DESC);

CREATE SEQUENCE IF NOT EXISTS public.complaint_number_seq;
CREATE OR REPLACE FUNCTION public.set_complaint_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := 'CC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.complaint_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_complaint_number ON public.customer_complaints;
CREATE TRIGGER trg_complaint_number BEFORE INSERT ON public.customer_complaints
FOR EACH ROW EXECUTE FUNCTION public.set_complaint_number();
DROP TRIGGER IF EXISTS trg_complaint_updated ON public.customer_complaints;
CREATE TRIGGER trg_complaint_updated BEFORE UPDATE ON public.customer_complaints
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Supplier SCAR
CREATE TABLE IF NOT EXISTS public.supplier_scars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT UNIQUE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  issue_description TEXT NOT NULL,
  containment_required TIMESTAMPTZ,
  root_cause_due TIMESTAMPTZ,
  corrective_action_due TIMESTAMPTZ,
  effectiveness_due TIMESTAMPTZ,
  supplier_response TEXT,
  root_cause TEXT,
  corrective_action TEXT,
  linked_nc_id UUID REFERENCES public.non_conformances(id) ON DELETE SET NULL,
  linked_incoming_lot_id UUID REFERENCES public.incoming_lots(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_scars TO authenticated;
GRANT ALL ON public.supplier_scars TO service_role;
ALTER TABLE public.supplier_scars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read scars" ON public.supplier_scars FOR SELECT TO authenticated USING (true);
CREATE POLICY "Quality manage scars" ON public.supplier_scars FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','supplier_quality_engineer','quality_engineer']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','supplier_quality_engineer','quality_engineer']));
CREATE INDEX IF NOT EXISTS idx_scars_status ON public.supplier_scars(status);
CREATE INDEX IF NOT EXISTS idx_scars_supplier ON public.supplier_scars(supplier_id);

CREATE SEQUENCE IF NOT EXISTS public.scar_number_seq;
CREATE OR REPLACE FUNCTION public.set_scar_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := 'SCAR-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.scar_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_scar_number ON public.supplier_scars;
CREATE TRIGGER trg_scar_number BEFORE INSERT ON public.supplier_scars
FOR EACH ROW EXECUTE FUNCTION public.set_scar_number();
DROP TRIGGER IF EXISTS trg_scar_updated ON public.supplier_scars;
CREATE TRIGGER trg_scar_updated BEFORE UPDATE ON public.supplier_scars
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Overdue escalation runner
CREATE OR REPLACE FUNCTION public.run_overdue_escalations()
RETURNS TABLE(entity_type TEXT, entity_id UUID, level INT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.id, c.capa_number, c.due_date, c.owner_id,
           CASE WHEN c.due_date < CURRENT_DATE - 14 THEN 3
                WHEN c.due_date < CURRENT_DATE - 7  THEN 2
                ELSE 1 END AS lvl
      FROM public.capa_records c
     WHERE c.due_date IS NOT NULL AND c.due_date < CURRENT_DATE
       AND c.status::TEXT NOT IN ('closed','verified','cancelled')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.escalations
       WHERE escalations.entity_type='capa_record' AND escalations.entity_id=r.id AND escalations.level=r.lvl
         AND escalated_at::DATE = CURRENT_DATE
    ) THEN
      INSERT INTO public.escalations(entity_type, entity_id, level, reason, escalated_to, escalated_at)
      VALUES ('capa_record', r.id, r.lvl,
              'CAPA ' || r.capa_number || ' overdue since ' || r.due_date, r.owner_id, now());
      PERFORM public.notify_role('quality_manager','escalation','high','capa_record', r.id,
        'CAPA ' || r.capa_number || ' overdue (L' || r.lvl || ')',
        'Due ' || r.due_date, '/capa/' || r.id);
      entity_type:='capa_record'; entity_id:=r.id; level:=r.lvl; RETURN NEXT;
    END IF;
  END LOOP;

  FOR r IN
    SELECT id, number, raised_at,
           CASE WHEN raised_at < now() - INTERVAL '30 days' THEN 3
                WHEN raised_at < now() - INTERVAL '14 days' THEN 2
                WHEN raised_at < now() - INTERVAL '7 days'  THEN 1
                ELSE 0 END AS lvl
      FROM public.non_conformances
     WHERE status IS DISTINCT FROM 'closed'
  LOOP
    IF r.lvl > 0 AND NOT EXISTS (
      SELECT 1 FROM public.escalations
       WHERE escalations.entity_type='non_conformance' AND escalations.entity_id=r.id AND escalations.level=r.lvl
         AND escalated_at::DATE = CURRENT_DATE
    ) THEN
      INSERT INTO public.escalations(entity_type, entity_id, level, reason, escalated_at)
      VALUES ('non_conformance', r.id, r.lvl, 'NC ' || r.number || ' still open', now());
      PERFORM public.notify_role('quality_manager','escalation','high','non_conformance', r.id,
        'NC ' || r.number || ' overdue (L' || r.lvl || ')',
        'Raised ' || r.raised_at::DATE, '/non-conformances/' || r.id);
      entity_type:='non_conformance'; entity_id:=r.id; level:=r.lvl; RETURN NEXT;
    END IF;
  END LOOP;
  RETURN;
END; $$;
GRANT EXECUTE ON FUNCTION public.run_overdue_escalations() TO authenticated;

-- ISO 2859-1 sampling
CREATE OR REPLACE FUNCTION public.iso_2859_1_sample(_lot_size INT, _aql NUMERIC)
RETURNS TABLE(code_letter TEXT, sample_size INT, accept INT, reject INT) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE letter TEXT; n INT;
BEGIN
  letter := CASE
    WHEN _lot_size <= 8 THEN 'A' WHEN _lot_size <= 15 THEN 'B' WHEN _lot_size <= 25 THEN 'C'
    WHEN _lot_size <= 50 THEN 'D' WHEN _lot_size <= 90 THEN 'E' WHEN _lot_size <= 150 THEN 'F'
    WHEN _lot_size <= 280 THEN 'G' WHEN _lot_size <= 500 THEN 'H' WHEN _lot_size <= 1200 THEN 'J'
    WHEN _lot_size <= 3200 THEN 'K' WHEN _lot_size <= 10000 THEN 'L' WHEN _lot_size <= 35000 THEN 'M'
    WHEN _lot_size <= 150000 THEN 'N' WHEN _lot_size <= 500000 THEN 'P' ELSE 'Q' END;
  n := CASE letter
    WHEN 'A' THEN 2 WHEN 'B' THEN 3 WHEN 'C' THEN 5 WHEN 'D' THEN 8 WHEN 'E' THEN 13
    WHEN 'F' THEN 20 WHEN 'G' THEN 32 WHEN 'H' THEN 50 WHEN 'J' THEN 80 WHEN 'K' THEN 125
    WHEN 'L' THEN 200 WHEN 'M' THEN 315 WHEN 'N' THEN 500 WHEN 'P' THEN 800 ELSE 1250 END;
  code_letter := letter;
  sample_size := n;
  accept := CASE
    WHEN _aql <= 0.10 THEN GREATEST(0, floor(n*0.005)::INT)
    WHEN _aql <= 0.65 THEN GREATEST(0, floor(n*0.01)::INT)
    WHEN _aql <= 1.0 THEN GREATEST(0, floor(n*0.02)::INT)
    WHEN _aql <= 2.5 THEN GREATEST(1, floor(n*0.04)::INT)
    WHEN _aql <= 4.0 THEN GREATEST(2, floor(n*0.06)::INT)
    ELSE GREATEST(3, floor(n*0.10)::INT) END;
  reject := accept + 1;
  RETURN NEXT;
END; $$;
GRANT EXECUTE ON FUNCTION public.iso_2859_1_sample(INT, NUMERIC) TO authenticated;

-- KPI view
CREATE OR REPLACE VIEW public.qms_kpi_summary AS
SELECT
  (SELECT COUNT(*) FROM public.inspections)                                          AS total_inspections,
  (SELECT COUNT(*) FROM public.inspections WHERE status='completed')                 AS inspections_completed,
  (SELECT COUNT(*) FROM public.inspections WHERE status='completed'
    AND created_at >= now() - INTERVAL '30 days')                                    AS inspections_completed_30d,
  (SELECT COUNT(*) FROM public.non_conformances)                                     AS total_ncs,
  (SELECT COUNT(*) FROM public.non_conformances WHERE status IS DISTINCT FROM 'closed') AS open_ncs,
  (SELECT COUNT(*) FROM public.non_conformances WHERE status='closed'
    AND closed_at >= now() - INTERVAL '30 days')                                     AS closed_ncs_30d,
  (SELECT COALESCE(SUM(COALESCE(cost_scrap,0)+COALESCE(cost_rework,0)+COALESCE(cost_sort,0)
     +COALESCE(cost_downtime,0)+COALESCE(cost_freight_return,0)+COALESCE(cost_warranty,0)),0)
   FROM public.non_conformances WHERE raised_at >= now() - INTERVAL '30 days')       AS copq_30d,
  (SELECT COUNT(*) FROM public.capa_records WHERE status::TEXT NOT IN ('closed','verified','cancelled')) AS open_capas,
  (SELECT COUNT(*) FROM public.capa_records WHERE due_date < CURRENT_DATE
    AND status::TEXT NOT IN ('closed','verified','cancelled'))                       AS overdue_capas,
  (SELECT COUNT(*) FROM public.quality_holds WHERE status::TEXT NOT IN ('released','closed','cleared')) AS active_holds,
  (SELECT COUNT(*) FROM public.spc_signals WHERE resolved = false)                   AS open_spc_signals,
  (SELECT COUNT(*) FROM public.gages WHERE status='oot')                             AS gages_oot,
  (SELECT COUNT(*) FROM public.gages WHERE next_cal_date < CURRENT_DATE)             AS gages_overdue_cal,
  (SELECT COUNT(*) FROM public.customer_complaints WHERE status='open')              AS open_complaints,
  (SELECT COUNT(*) FROM public.supplier_scars WHERE status='open')                   AS open_scars;

GRANT SELECT ON public.qms_kpi_summary TO authenticated;
