-- RECOVER.03 follow-up: Supabase default ACL may grant EXECUTE to anon directly.
-- Revoke it explicitly; the owner-authenticated RPC remains SECURITY INVOKER.
revoke all on function public.jtv_record_checkpoint(text,double precision,double precision,timestamptz) from anon;
