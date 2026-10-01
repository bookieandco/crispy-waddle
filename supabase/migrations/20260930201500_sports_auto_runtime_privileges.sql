-- SPORT-AUTO runtime privilege hardening.
-- Supabase grants service_role broad privileges on newly-created public tables;
-- tighten them to the runtime store's actual mutation contract.

REVOKE ALL ON public.sports_auto_candidates FROM service_role;
GRANT SELECT, INSERT, UPDATE ON public.sports_auto_candidates TO service_role;

REVOKE ALL ON public.sports_paper_decisions FROM service_role;
GRANT SELECT, INSERT ON public.sports_paper_decisions TO service_role;

REVOKE ALL ON public.sports_paper_resolutions FROM service_role;
GRANT SELECT, INSERT ON public.sports_paper_resolutions TO service_role;
