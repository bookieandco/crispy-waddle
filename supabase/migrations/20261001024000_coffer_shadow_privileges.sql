-- COFFER-SHADOW.FINAL post-commission privilege hardening.
-- Supabase default table grants can preserve UPDATE/DELETE on service_role.
-- Shadow evidence is append-only by contract.

REVOKE ALL ON public.money_dex_shadow_runs FROM service_role;
GRANT SELECT, INSERT ON public.money_dex_shadow_runs TO service_role;
