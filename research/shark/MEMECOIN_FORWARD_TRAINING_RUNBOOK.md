# SHARK → Shadow → Jhadina: forward memecoin research cohort

Established 2026-10-12. Research and paper learning only. No real funds, wallet keys, trade orders, signed transactions, performance claims, or authorization to trade.

## First three Solana contracts
See memecoin-cohort-2026-10-12.json. These were supplied by the owner. Only the first address had a matching public DexScreener token profile on 2026-10-12 (HUMPH); that is not proof of live liquidity or safety. The other token identities, live prices and security properties are UNKNOWN until independently observed.

## Google Colab / Drive procedure
Open notebooks/SHARK_MEMECOIN_COLAB_INTAKE_20261012.ipynb in Colab, signed into the owner Google account that can access SHADOW-PAPER-TRADING/02-MARKET-REPLAY.

1. Run intake cell and approve the Google consent prompt. It uses the existing verified Drive folder ID, creates a subfolder SHARK-MEMECOIN-FORWARD-TRAINING if needed, queries DexScreener once, and uploads an independently readback-verified, timestamped snapshot.
2. Rerun later to acquire new provider observations. The collector UTC receipt timestamp is a proxy, not a provider tick timestamp. No continuous background operation is implied.
3. Run the second, optional forward-label cell after repeated snapshots. The same Solana token/pair must have a future snapshot within a strict post-horizon timing tolerance. Missing prices and unmatched horizons remain UNGRADED.
4. Freeze genuine predictions before their horizon; independently verify rug exposure, authority controls, wallet clusters, token trading limitations and realistic fees/slippage before scoring strategy claims.

## Evidence boundaries
- Market endpoint: https://api.dexscreener.com/tokens/v1/solana/{comma-separated-addresses}, with documented 300 requests/minute rate limit. One HTTP request per collection run.
- Archive includes raw provider response and its SHA-256. Drive readback verifies stored bytes, not economic truth.
- NO_BASE_TOKEN_PAIR_IN_RESPONSE means no base-token pair in that API response, not that a token does not exist.
- Snapshot returns are training labels, not simulated order fills or profit.
- Evaluate chronologically out of sample; account for survivorship bias, drawdown, costs, missing observations and calibration.
- This cohort is distinct from the unrecovered original Shadow ledger. Do not claim restoration, model profitability, live authorization or completed predictions.
- Storage-only Google One does not guarantee premium Colab compute; owner billing cannot be inferred from Drive access.
- SWLC Supabase was reachable on 2026-10-12, but default_transaction_read_only was on: DB write repair still needed. This notebook archives through owner Google Drive, not Supabase.
