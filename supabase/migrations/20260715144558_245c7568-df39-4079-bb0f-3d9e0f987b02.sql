
-- 1) Cron run log
CREATE TABLE IF NOT EXISTS public.cron_run_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  rows_affected INTEGER,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cron_run_log TO authenticated;
GRANT ALL ON public.cron_run_log TO service_role;
ALTER TABLE public.cron_run_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cron_log_read_admins" ON public.cron_run_log;
CREATE POLICY "cron_log_read_admins" ON public.cron_run_log FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','auditor']));
CREATE INDEX IF NOT EXISTS idx_cron_run_log_ran_at ON public.cron_run_log(ran_at DESC);

-- 2) Extend SPC signal evaluator with Nelson rules 4-8
CREATE OR REPLACE FUNCTION public.evaluate_spc_signals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chart_id UUID;
  v_cl RECORD;
  v_recent NUMERIC[];
  v_i INT;
  v_above INT; v_below INT;
  v_trend_up INT; v_trend_down INT;
  v_alt INT;
  v_c1 INT; v_c2 INT; v_c15 INT; v_c8 INT;
  v_sigma NUMERIC;
  v_two_sig NUMERIC; v_one_sig NUMERIC;
  v_signals TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT id INTO v_chart_id FROM public.spc_charts
   WHERE (spec_item_id = NEW.spec_item_id OR product_id = NEW.product_id)
   ORDER BY created_at DESC LIMIT 1;
  IF v_chart_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_cl FROM public.spc_control_limits
   WHERE chart_id = v_chart_id
     AND (effective_from IS NULL OR effective_from <= now())
     AND (effective_until IS NULL OR effective_until > now())
   ORDER BY version DESC LIMIT 1;
  IF v_cl IS NULL THEN RETURN NEW; END IF;

  v_sigma := GREATEST((v_cl.ucl - v_cl.center_line) / 3.0, 0.000001);
  v_two_sig := 2 * v_sigma;
  v_one_sig := v_sigma;

  -- Rule 1: Beyond 3σ
  IF NEW.x_bar > v_cl.ucl OR NEW.x_bar < v_cl.lcl THEN
    v_signals := array_append(v_signals, 'nelson_1_beyond_3sigma');
  END IF;

  -- fetch last 15 samples in chronological order (newest first)
  SELECT ARRAY(
    SELECT x_bar FROM public.spc_samples
     WHERE (spec_item_id = NEW.spec_item_id AND product_id IS NOT DISTINCT FROM NEW.product_id)
       AND sample_time <= NEW.sample_time
     ORDER BY sample_time DESC LIMIT 15
  ) INTO v_recent;

  -- Rule 2: 9 points same side of centerline
  IF array_length(v_recent, 1) >= 9 THEN
    v_above := 0; v_below := 0;
    FOR v_i IN 1..9 LOOP
      IF v_recent[v_i] > v_cl.center_line THEN v_above := v_above + 1;
      ELSIF v_recent[v_i] < v_cl.center_line THEN v_below := v_below + 1; END IF;
    END LOOP;
    IF v_above = 9 OR v_below = 9 THEN
      v_signals := array_append(v_signals, 'nelson_2_run_of_9');
    END IF;
  END IF;

  -- Rule 3: 6 points trending
  IF array_length(v_recent, 1) >= 6 THEN
    v_trend_up := 0; v_trend_down := 0;
    FOR v_i IN 1..5 LOOP
      IF v_recent[v_i] > v_recent[v_i+1] THEN v_trend_up := v_trend_up + 1;
      ELSIF v_recent[v_i] < v_recent[v_i+1] THEN v_trend_down := v_trend_down + 1; END IF;
    END LOOP;
    IF v_trend_up = 5 OR v_trend_down = 5 THEN
      v_signals := array_append(v_signals, 'nelson_3_trend_of_6');
    END IF;
  END IF;

  -- Rule 4: 14 alternating up/down
  IF array_length(v_recent, 1) >= 14 THEN
    v_alt := 0;
    FOR v_i IN 1..13 LOOP
      IF v_i > 1 AND (
        (v_recent[v_i] > v_recent[v_i+1] AND v_recent[v_i-1] > v_recent[v_i])
        OR (v_recent[v_i] < v_recent[v_i+1] AND v_recent[v_i-1] < v_recent[v_i])
      ) THEN
        EXIT;
      END IF;
      v_alt := v_alt + 1;
    END LOOP;
    IF v_alt >= 13 THEN
      v_signals := array_append(v_signals, 'nelson_4_alternating_14');
    END IF;
  END IF;

  -- Rule 5: 2 of 3 points beyond 2σ (same side)
  IF array_length(v_recent, 1) >= 3 THEN
    v_c1 := 0; v_c2 := 0;
    FOR v_i IN 1..3 LOOP
      IF v_recent[v_i] > v_cl.center_line + v_two_sig THEN v_c1 := v_c1 + 1;
      ELSIF v_recent[v_i] < v_cl.center_line - v_two_sig THEN v_c2 := v_c2 + 1; END IF;
    END LOOP;
    IF v_c1 >= 2 OR v_c2 >= 2 THEN
      v_signals := array_append(v_signals, 'nelson_5_two_of_three_beyond_2sigma');
    END IF;
  END IF;

  -- Rule 6: 4 of 5 points beyond 1σ (same side)
  IF array_length(v_recent, 1) >= 5 THEN
    v_c1 := 0; v_c2 := 0;
    FOR v_i IN 1..5 LOOP
      IF v_recent[v_i] > v_cl.center_line + v_one_sig THEN v_c1 := v_c1 + 1;
      ELSIF v_recent[v_i] < v_cl.center_line - v_one_sig THEN v_c2 := v_c2 + 1; END IF;
    END LOOP;
    IF v_c1 >= 4 OR v_c2 >= 4 THEN
      v_signals := array_append(v_signals, 'nelson_6_four_of_five_beyond_1sigma');
    END IF;
  END IF;

  -- Rule 7: 15 points within 1σ of centerline
  IF array_length(v_recent, 1) >= 15 THEN
    v_c15 := 0;
    FOR v_i IN 1..15 LOOP
      IF v_recent[v_i] > v_cl.center_line - v_one_sig AND v_recent[v_i] < v_cl.center_line + v_one_sig THEN
        v_c15 := v_c15 + 1;
      END IF;
    END LOOP;
    IF v_c15 = 15 THEN
      v_signals := array_append(v_signals, 'nelson_7_fifteen_within_1sigma');
    END IF;
  END IF;

  -- Rule 8: 8 consecutive points beyond 1σ (either side, none within)
  IF array_length(v_recent, 1) >= 8 THEN
    v_c8 := 0;
    FOR v_i IN 1..8 LOOP
      IF v_recent[v_i] > v_cl.center_line + v_one_sig OR v_recent[v_i] < v_cl.center_line - v_one_sig THEN
        v_c8 := v_c8 + 1;
      END IF;
    END LOOP;
    IF v_c8 = 8 THEN
      v_signals := array_append(v_signals, 'nelson_8_eight_beyond_1sigma');
    END IF;
  END IF;

  IF array_length(v_signals, 1) > 0 THEN
    UPDATE public.spc_samples SET out_of_control_rules = to_jsonb(v_signals),
      ucl = v_cl.ucl, lcl = v_cl.lcl WHERE id = NEW.id;
    FOR v_i IN 1..array_length(v_signals,1) LOOP
      INSERT INTO public.spc_signals(chart_id, sample_id, rule_violated, severity, detected_at)
      VALUES (v_chart_id, NEW.id, v_signals[v_i],
        CASE WHEN v_signals[v_i] IN ('nelson_1_beyond_3sigma','nelson_5_two_of_three_beyond_2sigma') THEN 'high' ELSE 'medium' END, now());
    END LOOP;
    PERFORM public.notify_role('quality_engineer','spc','warning','spc_sample', NEW.id,
      'SPC rule violation on chart', array_to_string(v_signals, ', '), NULL);
  END IF;
  RETURN NEW;
END; $function$;

-- 3) SCAR notifications trigger
CREATE OR REPLACE FUNCTION public.notify_scar_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_role('supplier_quality_engineer','scar','warning','supplier_scar', NEW.id,
      'New SCAR ' || NEW.number, 'Severity: ' || COALESCE(NEW.severity,'?'),
      '/supplier-scars/' || NEW.id);
    IF NEW.assigned_to IS NOT NULL THEN
      PERFORM public.notify(NEW.assigned_to,'scar','info','supplier_scar', NEW.id,
        'SCAR ' || NEW.number || ' assigned to you', NULL, '/supplier-scars/' || NEW.id);
    END IF;
  ELSIF TG_OP='UPDATE' THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
      PERFORM public.notify(NEW.assigned_to,'scar','info','supplier_scar', NEW.id,
        'SCAR ' || NEW.number || ' assigned to you', NULL, '/supplier-scars/' || NEW.id);
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.notify_role('supplier_quality_engineer','scar','info','supplier_scar', NEW.id,
        'SCAR ' || NEW.number || ' status: ' || NEW.status, NULL, '/supplier-scars/' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_scar_events ON public.supplier_scars;
CREATE TRIGGER trg_notify_scar_events AFTER INSERT OR UPDATE ON public.supplier_scars
  FOR EACH ROW EXECUTE FUNCTION public.notify_scar_events();

-- 4) Complaint notifications trigger
CREATE OR REPLACE FUNCTION public.notify_complaint_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_role('quality_manager','complaint','warning','customer_complaint', NEW.id,
      'New complaint ' || NEW.number, 'Customer: ' || COALESCE(NEW.customer_name,'?'),
      '/complaints/' || NEW.id);
    IF NEW.assigned_to IS NOT NULL THEN
      PERFORM public.notify(NEW.assigned_to,'complaint','info','customer_complaint', NEW.id,
        'Complaint ' || NEW.number || ' assigned to you', NULL, '/complaints/' || NEW.id);
    END IF;
  ELSIF TG_OP='UPDATE' THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
      PERFORM public.notify(NEW.assigned_to,'complaint','info','customer_complaint', NEW.id,
        'Complaint ' || NEW.number || ' assigned to you', NULL, '/complaints/' || NEW.id);
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.notify_role('quality_manager','complaint','info','customer_complaint', NEW.id,
        'Complaint ' || NEW.number || ' status: ' || NEW.status, NULL, '/complaints/' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_complaint_events ON public.customer_complaints;
CREATE TRIGGER trg_notify_complaint_events AFTER INSERT OR UPDATE ON public.customer_complaints
  FOR EACH ROW EXECUTE FUNCTION public.notify_complaint_events();

-- 5) Wrap escalations runner to log
CREATE OR REPLACE FUNCTION public.run_overdue_escalations_logged()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count INT := 0;
BEGIN
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.run_overdue_escalations();
    INSERT INTO public.cron_run_log(job_name,status,message,rows_affected)
    VALUES('run_overdue_escalations','ok',NULL,v_count);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.cron_run_log(job_name,status,message)
    VALUES('run_overdue_escalations','error',SQLERRM);
    RAISE;
  END;
  RETURN v_count;
END; $$;

-- 6) Schedule daily via pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='run_overdue_escalations_daily') THEN
    PERFORM cron.unschedule('run_overdue_escalations_daily');
  END IF;
  PERFORM cron.schedule('run_overdue_escalations_daily','0 7 * * *',
    $sql$ SELECT public.run_overdue_escalations_logged(); $sql$);
END $$;

-- 7) Grants on new function
REVOKE ALL ON FUNCTION public.run_overdue_escalations_logged() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.run_overdue_escalations_logged() TO authenticated, service_role;

-- 8) Compliance profiles: ensure at least one row exists
INSERT INTO public.compliance_profiles(code,name,description,require_esig,require_second_person_verification,retention_years,config)
SELECT 'iso9001','ISO 9001:2015','General QMS compliance profile',false,false,7,'{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.compliance_profiles);
