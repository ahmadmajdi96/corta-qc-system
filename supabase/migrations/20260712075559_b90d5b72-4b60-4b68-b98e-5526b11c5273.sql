GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, text[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, anon;