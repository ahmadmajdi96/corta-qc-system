
-- Set explicit search_path on remaining functions
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.set_nc_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE seq_val BIGINT;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    seq_val := nextval('public.nc_number_seq');
    NEW.number := 'NC-' || to_char(now(),'YYYY') || '-' || lpad(seq_val::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END; $$;

-- Restrict EXECUTE on SECURITY DEFINER helpers. RLS policies invoke them
-- with the postgres role internally, so revoking public/anon/authenticated
-- EXECUTE does not break policy evaluation.
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_role(UUID, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
