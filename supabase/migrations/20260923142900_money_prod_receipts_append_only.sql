-- Global launch repair: Money production certification receipts are append-only.
-- Runtime stores only INSERT and SELECT. No receipt may be rewritten or deleted.

REVOKE ALL ON TABLE public.money_production_commissioning_receipts FROM service_role;
GRANT SELECT, INSERT ON TABLE public.money_production_commissioning_receipts TO service_role;

REVOKE ALL ON TABLE public.money_production_platform_receipts FROM service_role;
GRANT SELECT, INSERT ON TABLE public.money_production_platform_receipts TO service_role;
