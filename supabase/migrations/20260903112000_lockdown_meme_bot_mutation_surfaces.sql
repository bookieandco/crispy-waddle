-- Meme Bot / SHARK intelligence is not a client-controlled mutation plane.
-- Browser roles receive only explicitly intended read access; ingestion and
-- candidate generation remain server-side and must cross the governed authority boundary.

revoke all on table public.jhadina_shark_market_events from anon, authenticated;
revoke all on table public.jhadina_sniper_candidates from anon, authenticated;
revoke all on table public.jhadina_token_launches from anon, authenticated;
revoke all on table public.jhadina_wallet_entities from anon, authenticated;
revoke all on table public.jhadina_wallet_intelligence_observations from anon, authenticated;
revoke all on table public.jhadina_mining_processed_payouts from anon, authenticated;
revoke all on table public.jhadina_mining_scan_checkpoints from anon, authenticated;
revoke all on table public.jhadina_wallets from anon, authenticated;
revoke all on table public.jhadina_wallet_challenges from anon, authenticated;

grant select on table public.jhadina_shark_market_events to authenticated;
grant select on table public.jhadina_sniper_candidates to authenticated;
grant select on table public.jhadina_token_launches to authenticated;
grant select on table public.jhadina_wallet_entities to authenticated;
grant select on table public.jhadina_wallet_intelligence_observations to authenticated;
grant select on table public.jhadina_mining_scan_checkpoints to authenticated;
grant select on table public.jhadina_wallets to authenticated;
grant select on table public.jhadina_wallet_challenges to authenticated;
