# WATCHKEEPER.05–.07 — Source completion and operational boundary

**Date:** 2026-10-14 (America/Los_Angeles)
**Runtime:** Research-only. No private keys, signing, wallet, Swap API
transaction construction, order placement, billing, database writes, strategy
revisions, scheduler activation or funds movement.

## .05 — reviewed and merged

WATCHKEEPER.01–.04 source-only PR #1286 received passing SHARK safety/paper
CI, Spatial Conformance and Jhadina Launch Gate checks. Inspected the
changed source for network/signing/trading paths (offline only). Squash merge
to main commit 67088f900184037d7981bd187e4cf807888b9483.
This does **not** certify its simulation results, a genuine owner-signed
authorization or Supabase availability.

## .06 — bounded single-slot Solana pool/vault snapshot

Paths: ops/meme/single_slot_pool_observer.py and corresponding tests.

- Reuses pool offsets and Solana program IDs from pool_vault_probe.py.
- Takes a known, bounded PumpSwap or Raydium AMM V4 pool address, mints,
  two expected vault addresses, and prior market evidence digest.
- Calls only Solana JSON-RPC getMultipleAccounts on fixed unauthenticated
  public-mainnet hosts via HTTP POST (POST is for read-only RPC, not
  a transaction). All three raw account values share the **same RPC context
  slot**; no stale cross-call reserve arithmetic.
- Independently checks the pool program owner, exact decoded pool mints and
  vault addresses, SPL token program owners, vault mint bytes, token account
  state and raw reserves. Catches malformed/frozen/zero vault cases.
- Date-scoped source/event availability and one-shot <=15s request window,
  bounded payload and limited retry. No untrusted arbitrary user-supplied URL.
- Reads are observable facts about a single public RPC provider, **not**
  independent RPC agreement or verifiable history. The account pubkeys
  and on-chain pool program still need external verification.
- No pool fee schedule, SPL decimals, Token-2022 transfer-fee extension,
  LP/burn/lock ownership, authority graph, separate price valuation or
  buy/sell executable route was independently verified. Output is always
  SINGLE_RPC_CONTEXT_PARTIAL_UNVERIFIED and canEnterPaper=false.
- CLI is a manual, explicitly requested read-only sample. It writes a
  local JSON output (not GitHub, Supabase or a live signer). Never
  auto-promotes a positive snapshot to independent evidence or sellability.

Run manually only with a separately grounded candidate from an earlier
verified pool-vault probe (NO arbitrary wallet/private endpoint):

    python ops/meme/single_slot_pool_observer.py --candidate /private/candidate.json --out /private/snapshot.json

## .07 — conservative offline paper execution evaluation

Paths: ops/meme/paper_replay_runner.py and corresponding tests.

- Performs no network calls; reuses paper_shadow_lab.py safety admission,
  strict time-scoped route validation, bounded virtual sizing/participation,
  entry cost, reserve conditions, missing route and sell capacity NO_FILL.
- If a .06 PUBLIC_SINGLE_SLOT_OBSERVATION is the only market evidence, it
  returns ABSTAIN with reason READ_ONLY_POOL_ONLY_NO_INDEPENDENT_SELLABILITY.
- An externally supplied EXTERNAL_PAPER_RESEARCH scenario with a valid .06
  receipt, separate claimed independent safety attestations and point-in-time
  route quote may produce **counterfactual** trade math. It is *never*
  an independently authenticated fill or a certified paper result.
  Operator-provided claims cannot confer wallet or account authority.
- Synthetic fixtures are allowed only under SYNTHETIC_TEST and cannot
  claim to be real observations. Missing exit = COUNTERFACTUAL_OPEN_OR_UNSELLABLE
  and net P&L stays null; no invented profitable stop or forced exit.
- All results have actualTradeCount=0, paperFillCountCertified=0,
  canExecute/canSign/canBroadcast/canAuthorizeLive/canRewriteRules=false.
- WARNING: Submitted external safety booleans or routeVerified=True fields
  are NOT independently authenticated by this harness. Never transfer
  these outputs to forward-validation .04 as witnessed actual fills.
- Batch limit 1000, duplicate case rejection, JSON report with hash receipt.
  SHA-256 is local checksum only, not external notarization.

Example only with separately sourced research cases:

    python ops/meme/paper_replay_runner.py --cases /private/paper-cases.json --out /private/paper-results.json

## CI acceptance

    python -m unittest discover -s ops/meme -p 'test_*.py' -v
    python -m compileall -q ops/meme

Existing jhadina-meme-7day-safety-ci.yml runs both on ops/meme PR changes,
with checkout using persist-credentials:false and no secret access.
Test cases are synthetic and network mocked.

## Honest remaining gaps / do not cross

No real read-only public-node snapshot has been obtained through .06 on
this branch merely by running synthetic unit tests; no source receipts
from distinct independent RPC providers reconciled, no fee parser or real
two-sided executable route. No real filled virtual trades or proven
sellability. Public 7-day report has 0 confirmed paper fills / real trades.
No background worker or server commissioning, no guarantee phone-off use.
Swlc Supabase Free plan data exceeds size allowance and remains read-only;
missing SHARK-ingress migration and independently restored encrypted backup.
Keep gating issues #1110, #1257 and capacity PR #1285 open.

NEXT: .08 attach independently verified route/fee/provider provenance to
the paper simulator and to Shadow Learning with true point-in-time constraints;
.09 bounded always-on worker and independent journaling; .10 prospective
evaluation after October 20 without artificial performance numbers.
