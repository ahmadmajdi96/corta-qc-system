
ALTER TABLE public.gauge_usage_history ADD COLUMN IF NOT EXISTS context jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.hold_scope_actions ALTER COLUMN qty_delta SET DEFAULT 0;
ALTER TABLE public.hold_scope_actions ALTER COLUMN qty_delta DROP NOT NULL;
ALTER TABLE public.hold_scope_actions ALTER COLUMN before_qty DROP NOT NULL;
ALTER TABLE public.hold_scope_actions ALTER COLUMN after_qty  DROP NOT NULL;
ALTER TABLE public.hold_scope_actions ALTER COLUMN reason     DROP NOT NULL;
ALTER TABLE public.hold_scope_actions ALTER COLUMN authorized_by DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.log_hold_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.hold_scope_actions(
      hold_id, action, reason, authorized_by, performed_at,
      before_qty, after_qty, qty_delta
    ) VALUES (
      NEW.id, 'status:' || NEW.status::TEXT, COALESCE(NEW.notes, ''),
      COALESCE(auth.uid(), NEW.created_by), now(),
      COALESCE(OLD.qty_held, 0), COALESCE(NEW.qty_held, 0),
      COALESCE(NEW.qty_held, 0) - COALESCE(OLD.qty_held, 0)
    );
    IF NEW.status::TEXT IN ('released','closed','cleared')
       AND OLD.status::TEXT NOT IN ('released','closed','cleared') THEN
      NEW.resolved_at := COALESCE(NEW.resolved_at, now());
      NEW.resolved_by := COALESCE(NEW.resolved_by, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
