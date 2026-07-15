
-- 1) Freeze approved plans: block edits on plan_characteristics when parent plan is approved
CREATE OR REPLACE FUNCTION public.enforce_plan_frozen()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status TEXT;
  v_plan_id UUID;
BEGIN
  v_plan_id := COALESCE(NEW.plan_id, OLD.plan_id);
  SELECT revision_status INTO v_status FROM public.inspection_plans WHERE id = v_plan_id;
  IF v_status = 'approved' THEN
    RAISE EXCEPTION 'Plan is approved and frozen. Create a new revision to modify characteristics.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_plan_char_frozen ON public.plan_characteristics;
CREATE TRIGGER trg_plan_char_frozen
BEFORE INSERT OR UPDATE OR DELETE ON public.plan_characteristics
FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_frozen();

-- 2) Plan approval: snapshot rows into plan_revisions
CREATE OR REPLACE FUNCTION public.approve_inspection_plan(_plan_id UUID, _reason TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rev_id UUID;
  v_plan RECORD;
  v_next_version INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_any_role(v_uid, ARRAY['administrator','quality_manager','engineer']) THEN
    RAISE EXCEPTION 'Insufficient privileges to approve plans';
  END IF;

  SELECT * INTO v_plan FROM public.inspection_plans WHERE id = _plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;
  IF v_plan.revision_status = 'approved' THEN
    RAISE EXCEPTION 'Plan is already approved';
  END IF;

  SELECT COALESCE(MAX(version),0)+1 INTO v_next_version
    FROM public.plan_revisions WHERE plan_id = _plan_id;

  INSERT INTO public.plan_revisions (plan_id, version, snapshot, approved_by, approved_at, approval_reason)
  VALUES (
    _plan_id,
    v_next_version,
    jsonb_build_object(
      'plan', to_jsonb(v_plan),
      'characteristics', (SELECT COALESCE(jsonb_agg(to_jsonb(pc) ORDER BY pc.sequence), '[]'::jsonb)
                          FROM public.plan_characteristics pc WHERE pc.plan_id = _plan_id)
    ),
    v_uid, now(), _reason
  )
  RETURNING id INTO v_rev_id;

  UPDATE public.inspection_plans
     SET revision_status = 'approved',
         approved_by = v_uid,
         approved_at = now(),
         approval_reason = _reason,
         version = v_next_version,
         effective_from = now(),
         updated_at = now()
   WHERE id = _plan_id;

  RETURN v_rev_id;
END; $$;

-- 3) Create new revision from an approved plan (unfreeze copy)
CREATE OR REPLACE FUNCTION public.new_plan_revision(_plan_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_any_role(v_uid, ARRAY['administrator','quality_manager','engineer']) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  UPDATE public.inspection_plans
     SET revision_status = 'draft',
         effective_until = now(),
         updated_at = now()
   WHERE id = _plan_id AND revision_status = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not approved or missing'; END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.approve_inspection_plan(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.new_plan_revision(UUID) TO authenticated;

-- 4) Calibration gate: block measurements taken with an out-of-cal or inactive gage
CREATE OR REPLACE FUNCTION public.enforce_gage_calibrated()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g RECORD;
BEGIN
  IF NEW.gage_id IS NULL THEN RETURN NEW; END IF;
  SELECT status, next_cal_date, code, name INTO g FROM public.gages WHERE id = NEW.gage_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF g.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Gage % (%) status is %; cannot record measurement.', g.code, g.name, g.status
      USING ERRCODE = 'check_violation';
  END IF;
  IF g.next_cal_date IS NOT NULL AND g.next_cal_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Gage % (%) is past due for calibration (%). Recalibrate before recording measurements.', g.code, g.name, g.next_cal_date
      USING ERRCODE = 'check_violation';
  END IF;
  -- Log usage
  INSERT INTO public.gauge_usage_history (gage_id, used_by, used_at, context)
  VALUES (NEW.gage_id, auth.uid(), now(),
    jsonb_build_object('inspection_id', NEW.inspection_id, 'measurement_id', NEW.id));
  -- Bump usage_count
  UPDATE public.gages SET usage_count = COALESCE(usage_count,0)+1 WHERE id = NEW.gage_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_meas_gage_cal ON public.inspection_measurements;
CREATE TRIGGER trg_meas_gage_cal
BEFORE INSERT ON public.inspection_measurements
FOR EACH ROW EXECUTE FUNCTION public.enforce_gage_calibrated();

-- 5) Lock spc_control_limits once locked_at is set
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='spc_control_limits' AND column_name='locked_at') THEN
    ALTER TABLE public.spc_control_limits ADD COLUMN locked_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_spc_limits_locked()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL AND TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION 'Control limits are locked. Create a new limit set to revise.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_spc_limits_lock ON public.spc_control_limits;
CREATE TRIGGER trg_spc_limits_lock
BEFORE UPDATE OR DELETE ON public.spc_control_limits
FOR EACH ROW EXECUTE FUNCTION public.enforce_spc_limits_locked();
