
-- ============================================================
-- BATCH 2: NC closure gate + Hold logging + Notification helper
-- ============================================================

-- Universal notify() helper (SECURITY DEFINER to allow triggers to write for any recipient)
CREATE OR REPLACE FUNCTION public.notify(
  _recipient UUID, _category TEXT, _severity TEXT,
  _entity_type TEXT, _entity_id UUID, _title TEXT, _body TEXT DEFAULT NULL, _action_url TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF _recipient IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.notifications(recipient_id, category, severity, entity_type, entity_id, title, body, action_url)
  VALUES (_recipient, _category, _severity, _entity_type, _entity_id, _title, _body, _action_url)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- Notify all holders of a specific role
CREATE OR REPLACE FUNCTION public.notify_role(
  _role TEXT, _category TEXT, _severity TEXT,
  _entity_type TEXT, _entity_id UUID, _title TEXT, _body TEXT DEFAULT NULL, _action_url TEXT DEFAULT NULL
) RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT := 0; v_uid UUID;
BEGIN
  FOR v_uid IN
    SELECT ur.user_id FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id WHERE r.name = _role
  LOOP
    PERFORM public.notify(v_uid, _category, _severity, _entity_type, _entity_id, _title, _body, _action_url);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

-- Enforce NC closure requirements
CREATE OR REPLACE FUNCTION public.enforce_nc_closure()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hold_status TEXT;
BEGIN
  IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') THEN
    -- Require quantity reconciliation
    IF COALESCE(NEW.qty_affected, 0) > 0 AND NOT public.nc_qty_reconciles(NEW.id) THEN
      RAISE EXCEPTION 'Cannot close NC %: quantities do not reconcile (affected = released + reworked + scrapped + returned + use_as_is + downgraded + remaining_held).', NEW.number
        USING ERRCODE = 'check_violation';
    END IF;
    -- Require linked hold to be released
    IF NEW.hold_id IS NOT NULL THEN
      SELECT status::TEXT INTO v_hold_status FROM public.quality_holds WHERE id = NEW.hold_id;
      IF v_hold_status IS NOT NULL AND v_hold_status NOT IN ('released','closed','cleared') THEN
        RAISE EXCEPTION 'Cannot close NC %: linked hold is still % — release the hold first.', NEW.number, v_hold_status
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    NEW.closed_at := COALESCE(NEW.closed_at, now());
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_nc_closure ON public.non_conformances;
CREATE TRIGGER trg_nc_closure BEFORE UPDATE ON public.non_conformances
FOR EACH ROW EXECUTE FUNCTION public.enforce_nc_closure();

-- Notify quality managers on new NC + on close
CREATE OR REPLACE FUNCTION public.notify_nc_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_role('quality_manager','nc','warning','non_conformance',NEW.id,
      'New NC ' || NEW.number, 'Severity: ' || COALESCE(NEW.severity,'?'), '/non-conformances/' || NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    PERFORM public.notify_role('quality_manager','nc','info','non_conformance',NEW.id,
      'NC ' || NEW.number || ' closed', 'Disposition: ' || COALESCE(NEW.disposition,'—'), '/non-conformances/' || NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_nc_notify ON public.non_conformances;
CREATE TRIGGER trg_nc_notify AFTER INSERT OR UPDATE ON public.non_conformances
FOR EACH ROW EXECUTE FUNCTION public.notify_nc_events();

-- Log hold status transitions into hold_scope_actions
CREATE OR REPLACE FUNCTION public.log_hold_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.hold_scope_actions(hold_id, action, reason, authorized_by, performed_at, before_qty, after_qty)
    VALUES (NEW.id, 'status:' || NEW.status::TEXT, NEW.notes, auth.uid(), now(), OLD.qty_held, NEW.qty_held);
    IF NEW.status::TEXT IN ('released','closed','cleared') AND OLD.status::TEXT NOT IN ('released','closed','cleared') THEN
      NEW.resolved_at := COALESCE(NEW.resolved_at, now());
      NEW.resolved_by := COALESCE(NEW.resolved_by, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_hold_status ON public.quality_holds;
CREATE TRIGGER trg_hold_status BEFORE UPDATE ON public.quality_holds
FOR EACH ROW EXECUTE FUNCTION public.log_hold_status();

-- ============================================================
-- BATCH 3: SPC Nelson-rule engine on sample insert
-- ============================================================

CREATE OR REPLACE FUNCTION public.evaluate_spc_signals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_chart_id UUID;
  v_cl RECORD;
  v_recent NUMERIC[];
  v_prev RECORD;
  v_i INT;
  v_above INT; v_below INT;
  v_trend_up INT; v_trend_down INT;
  v_signals TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Find matching chart by spec_item or product
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

  -- Nelson Rule 1: single point beyond 3-sigma (UCL/LCL)
  IF NEW.x_bar > v_cl.ucl OR NEW.x_bar < v_cl.lcl THEN
    v_signals := array_append(v_signals, 'nelson_1_beyond_3sigma');
  END IF;

  -- Fetch last 9 samples for rules 2-4
  SELECT ARRAY(
    SELECT x_bar FROM public.spc_samples
     WHERE (spec_item_id = NEW.spec_item_id AND product_id IS NOT DISTINCT FROM NEW.product_id)
       AND sample_time <= NEW.sample_time
     ORDER BY sample_time DESC LIMIT 9
  ) INTO v_recent;

  -- Rule 2: 9 points on same side of center line
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

  -- Rule 3: 6 points in a row trending
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

  -- Persist signals + link to sample
  IF array_length(v_signals, 1) > 0 THEN
    UPDATE public.spc_samples SET out_of_control_rules = to_jsonb(v_signals),
      ucl = v_cl.ucl, lcl = v_cl.lcl WHERE id = NEW.id;
    FOR v_i IN 1..array_length(v_signals,1) LOOP
      INSERT INTO public.spc_signals(chart_id, sample_id, rule_violated, severity, detected_at)
      VALUES (v_chart_id, NEW.id, v_signals[v_i],
        CASE WHEN v_signals[v_i]='nelson_1_beyond_3sigma' THEN 'high' ELSE 'medium' END, now());
    END LOOP;
    -- Notify SPC engineers
    PERFORM public.notify_role('quality_engineer','spc','warning','spc_sample', NEW.id,
      'SPC rule violation on chart', array_to_string(v_signals, ', '), NULL);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_spc_eval ON public.spc_samples;
CREATE TRIGGER trg_spc_eval AFTER INSERT ON public.spc_samples
FOR EACH ROW EXECUTE FUNCTION public.evaluate_spc_signals();

-- ============================================================
-- BATCH 4: CAPA 8D phase gates
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_capa_8d_gates()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.methodology::TEXT <> '8d' THEN RETURN NEW; END IF;
  -- Phase ordering: D3 requires D2, D4 requires D3, D5 requires D4, D6 requires D5, D7 requires D6
  IF NEW.d3_containment IS NOT NULL AND (NEW.d2_problem IS NULL OR NEW.d2_problem = '') THEN
    RAISE EXCEPTION 'CAPA 8D: D2 (Problem description) must be completed before D3 (Containment).';
  END IF;
  IF NEW.d4_root_cause IS NOT NULL AND (NEW.d3_containment IS NULL OR NEW.d3_containment = '') THEN
    RAISE EXCEPTION 'CAPA 8D: D3 (Containment) must be completed before D4 (Root Cause).';
  END IF;
  IF NEW.d5_corrective IS NOT NULL AND (NEW.d4_root_cause IS NULL OR NEW.d4_root_cause = '') THEN
    RAISE EXCEPTION 'CAPA 8D: D4 (Root Cause) must be completed before D5 (Corrective Actions).';
  END IF;
  IF NEW.d6_implement IS NOT NULL AND (NEW.d5_corrective IS NULL OR NEW.d5_corrective = '') THEN
    RAISE EXCEPTION 'CAPA 8D: D5 (Corrective Actions) must be completed before D6 (Implement).';
  END IF;
  IF NEW.d7_prevent IS NOT NULL AND (NEW.d6_implement IS NULL OR NEW.d6_implement = '') THEN
    RAISE EXCEPTION 'CAPA 8D: D6 (Implement) must be completed before D7 (Preventive Actions).';
  END IF;
  -- Closure requires D7
  IF NEW.status::TEXT IN ('closed','verified') AND (OLD.status IS DISTINCT FROM NEW.status)
     AND (NEW.d7_prevent IS NULL OR NEW.d7_prevent = '') THEN
    RAISE EXCEPTION 'CAPA 8D cannot close without D7 (Preventive Actions).';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_capa_8d ON public.capa_records;
CREATE TRIGGER trg_capa_8d BEFORE UPDATE ON public.capa_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_capa_8d_gates();

-- Notify CAPA owner on assignment / due date changes
CREATE OR REPLACE FUNCTION public.notify_capa_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.owner_id IS NOT NULL THEN
    PERFORM public.notify(NEW.owner_id, 'capa','info','capa_record', NEW.id,
      'CAPA ' || NEW.capa_number || ' assigned to you',
      'Due: ' || COALESCE(NEW.due_date::TEXT,'—'), '/capa/' || NEW.id);
  ELSIF TG_OP='UPDATE' AND NEW.owner_id IS DISTINCT FROM OLD.owner_id AND NEW.owner_id IS NOT NULL THEN
    PERFORM public.notify(NEW.owner_id, 'capa','info','capa_record', NEW.id,
      'CAPA ' || NEW.capa_number || ' reassigned to you', NULL, '/capa/' || NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_capa_notify ON public.capa_records;
CREATE TRIGGER trg_capa_notify AFTER INSERT OR UPDATE ON public.capa_records
FOR EACH ROW EXECUTE FUNCTION public.notify_capa_events();

-- ============================================================
-- BATCH 5: Calibration OOT auto-workflow
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_cal_oot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_oot_id UUID; v_last_good TIMESTAMPTZ;
BEGIN
  IF NEW.is_oot = true AND NEW.impact_assessment_id IS NULL THEN
    -- Find last known good calibration to set suspect window
    SELECT performed_at INTO v_last_good FROM public.calibration_records
      WHERE gage_id = NEW.gage_id AND is_oot = false AND performed_at < NEW.performed_at
      ORDER BY performed_at DESC LIMIT 1;

    INSERT INTO public.oot_impact_assessments(
      calibration_record_id, gage_id, last_known_good_at,
      suspect_window_start, suspect_window_end,
      risk_summary
    ) VALUES (
      NEW.id, NEW.gage_id, v_last_good,
      COALESCE(v_last_good, NEW.performed_at - INTERVAL '90 days'),
      NEW.performed_at,
      'Auto-generated on OOT calibration. Assess affected inspections and lots.'
    ) RETURNING id INTO v_oot_id;

    NEW.impact_assessment_id := v_oot_id;

    -- Auto-flag the gage
    UPDATE public.gages SET status = 'oot', updated_at = now() WHERE id = NEW.gage_id;

    -- Notify calibration coordinators
    PERFORM public.notify_role('calibration_coordinator','calibration','high','gage', NEW.gage_id,
      'Gage OOT — impact assessment required',
      'Gage returned out-of-tolerance on ' || NEW.performed_at::DATE,
      '/calibration');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_cal_oot ON public.calibration_records;
CREATE TRIGGER trg_cal_oot BEFORE INSERT ON public.calibration_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_cal_oot();
