-- SOCIAL-FREE-FINAL.03 least-privilege table grants.
-- The canonical creator-record API only archives through an owner-scoped UPDATE.
-- Existing platform default privileges may grant DELETE to authenticated unless revoked explicitly.
revoke all on table public.jhadina_creator_campaign_records from public, anon, authenticated;
grant select, insert, update on table public.jhadina_creator_campaign_records to authenticated;
-- RLS remains enabled+forced with exact auth.uid owner checks.
