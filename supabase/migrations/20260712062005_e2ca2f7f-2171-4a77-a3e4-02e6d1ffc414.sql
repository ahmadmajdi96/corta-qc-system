
-- Requests: track incoming/outbound requests between departments (e.g., new product requests to QC)
CREATE TYPE public.request_kind AS ENUM ('new_product');
CREATE TYPE public.request_status AS ENUM ('pending','in_review','approved','rejected','completed','cancelled');

CREATE SEQUENCE IF NOT EXISTS public.request_number_seq;

CREATE TABLE public.requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  kind public.request_kind NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status public.request_status NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_notes TEXT,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  result_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  result_plan_id UUID REFERENCES public.inspection_plans(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_request_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v BIGINT;
BEGIN
  IF NEW.number IS NULL OR NEW.number='' THEN
    v := nextval('public.request_number_seq');
    NEW.number := 'REQ-' || to_char(now(),'YYYY') || '-' || lpad(v::text,4,'0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_requests_number BEFORE INSERT ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.set_request_number();

CREATE TRIGGER trg_requests_updated_at BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Audit log for status/step changes
CREATE TABLE public.request_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  from_status public.request_status,
  to_status public.request_status,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_requests_status ON public.requests(status);
CREATE INDEX idx_requests_requester ON public.requests(requester_id);
CREATE INDEX idx_requests_assignee ON public.requests(assignee_id);
CREATE INDEX idx_request_events_req ON public.request_events(request_id);

-- Product routings: sequence of stations for producing a product
CREATE TABLE public.product_routings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  station_id UUID NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, sequence)
);

CREATE TRIGGER trg_product_routings_updated_at BEFORE UPDATE ON public.product_routings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_product_routings_product ON public.product_routings(product_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_events TO authenticated;
GRANT ALL ON public.request_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_routings TO authenticated;
GRANT ALL ON public.product_routings TO service_role;
GRANT USAGE ON SEQUENCE public.request_number_seq TO authenticated;

-- RLS
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_routings ENABLE ROW LEVEL SECURITY;

-- Requests: any authenticated user can read all requests (needed for incoming/outbound views)
CREATE POLICY "Requests readable by authenticated" ON public.requests
  FOR SELECT TO authenticated USING (true);

-- Any authenticated user can create a request as themselves
CREATE POLICY "Users can create requests" ON public.requests
  FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());

-- Requester can update their own pending requests; assignees and QC roles can update
CREATE POLICY "Requester or QC can update" ON public.requests
  FOR UPDATE TO authenticated USING (
    requester_id = auth.uid()
    OR assignee_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer'])
  ) WITH CHECK (true);

-- Requester can delete their own pending
CREATE POLICY "Requester can delete pending" ON public.requests
  FOR DELETE TO authenticated USING (
    requester_id = auth.uid() AND status = 'pending'
  );

-- Events readable by any authenticated
CREATE POLICY "Request events readable" ON public.request_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Request events insert by authenticated" ON public.request_events
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- Product routings: readable by all authenticated, writable by QC roles
CREATE POLICY "Routings readable" ON public.product_routings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Routings writable by QC" ON public.product_routings
  FOR ALL TO authenticated USING (
    public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer'])
  ) WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['administrator','quality_manager','qc_engineer'])
  );
