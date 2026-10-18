# SHARK / SniperBot / MemeBot — deep system audit and PAPER.01–.04 handoff
Date: 2026-10-18 (America/Los_Angeles)
Repository: bookieandco/crispy-waddle
Reviewed working baseline: main at ad5830382d6c209dca63da41c93f2575d6ed2242
Scope: historical conversation-derived architecture, earlier Library deep-audit records,
current-main component reads, historical GitHub PR inventory and bounded source-only code.

## Executive conclusion

**Do not build another SHARK brain or signer.** The core memecoin intelligence and
governed Money orchestration is already implemented in source. The missing result is
a *single trustworthy research→decision→hypothetical outcome→validated learning*
loop across the canonical app and the opportunity/token-creator specialist.

The real goal is an autonomous but governed Jhadina who can eventually research
opportunities, make appropriately scoped trading decisions and propose/launch
original, transparently disclosed coins. PAPER.01–.04 expressly does **not**
commission or authorize that live operation.

### Original mission reconstructed from prior conversations

- Early Solana/Pump.fun intelligence, bonding-curve progress, PumpSwap migration,
  Raydium/Meteora pool evidence and venue-specific liquidity/inventory risks.
- Telegram, X, Reddit and Discord signal ingestion; learn which source, wallet,
  caller and dev actually produced useful *independent* evidence, dedupe common
  control and coordinated promotion.
- Rug/LP/Token-2022 controls, ownership, holder and funder graph, synthetic-volume
  and bundle/copy-trade reflexivity defenses. Prefer conservative unknown/abstain.
- Sniper specialist: prospective entry/exit/migration review, risk policy,
  costs, profit-taking proposals, paper positions and eventual governed execution.
- Meme creator specialist: original IP/branding and creator-service demand,
  disclosed allocations and tokenomics, hypothetical AMM and disclosed treasury
  models, eventual compliant/nondeceptive launch operations with owner mandates.
- MAKE IT MAKE SENSE challenges coherence. Money independently validates
  economics/risk. Purse/Coffer protects funding, owner reserves, treasury rules
  and permits. Action/providing venues own actual execution. SHADOW tests
  counterfactuals against genuinely later observations and feeds lessons back.

### Canonical safety separations

SHARK evidence != independently verified on-chain truth
MIMS PASS != an action authorization
Money admission != executable route or sellability
Purse allocation != signing or provider confirmation
Paper valuation != realized returns
Token Creator Studio preview != a deployed coin
An indicative price/liquidity valuation move != a proven rug/LP withdrawal

No hidden/undisclosed developer sales, fake volume, rug-pull backdoors,
minting without rights/compliance review or self-approving mandates.

## Existing source that was verified on main

| Layer | Canonical code / evidence | Current disposition |
|---|---|---|
| Research intelligence | packages/shark-intelligence-core/src/meme-trader/{assessment,actor-aware-assessment,decision-proposal,migration-radar,tracked-wallet-cohort,synthetic-volume-diagnostics,rug-self-protection}.ts | Exists. Evidence quality/availability depend on real producer. |
| App assembler | apps/jhadina-web/src/lib/shark/meme-assessment-worker.ts | Uses one persisted canonical actor-aware assessment and Money evidence; source does not by itself prove commissioned feed. |
| Research-to-Money | packages/money-core/src/{shark-intelligence-ingress,shark-coffer-runtime,shark-purse-bridge}.ts | Software orchestration exists; external commissioning separate. |
| Paper and Shadow | packages/money-core/src/{paper-execution-engine,shark-shadow-learning,shark-shadow-runpod-runtime}.ts | Significant code; real forward outcomes and recovery still need acceptance. |
| Creator Studio | packages/opportunity-core/src/domain/{meme-venture,meme-profit-policy,meme-paper-learning,meme-paper-exit}.ts | Existing rights/allocation/no-artificial-volume gates and hypothetical modeling. |
| Creator persistence | apps/jhadina-web/src/lib/opportunities/meme-studio-runtime.ts | Owner-scoped draft path exists; runtime database/RLS acceptance must be proven. |
| Study sampler | ops/meme/experiment_7day.py + state.json on experiments/meme-20261013-seven-day-001 | Separate observational collector, not full canonical assessment, not executable P&L. |
| Follow-up closeout | PR #1409 (DRAFT) | Historical-peak warning reconciliation, paper evidence handoff and persisted END verification. Not merged as of this review. |

Historical PRs: #1002 (source/migration/wallet fold), #1003/#1005/#1046
(SHARK–Money–MIMS–Coffer runtime), #1052 (Shadow research), #1312
(MEME-VENTURE studio), #1314 (draft runtime), #1315 (treasury paper
policy), #1319 (MEME-PROFIT paper exit/learning), #1242/#1149/#1185
(Shadow recovery/research repairs in unmerged branches).
Do not selectively call an old branch merged without reading GitHub metadata.

## Prior deep audit: significant unclosed acceptance questions

The archived 2026-10-12 memecoin/Shadow deep audit reported concrete
defects (historical test evidence, NOT automatically a current-main verdict):

1. The complete canonical actor-aware production source producer and persistent
   ingress are not yet established end-to-end.
2. Some Shadow outcome code graded price **after** the requested horizon,
   blurring real 15-minute / 1-hour / later evidence windows.
3. A failure between observation write, lesson write and outbox enqueue could
   leave work stuck after replay. Stage-wise idempotency is required.
4. Missing decision-relative entry prices could become zero-return lessons,
   or launch-relative numbers could be misrepresented as trade returns.
5. Provider response token orientation and quote freshness were not fully
   validated in all inspected paths.
6. Overlapping memory cards and multiple correlated horizons could inflate
   counts of independent evidence.
7. A stored RunPod archive was not automatically a validated canonical lesson.
8. Simulated fills were not guaranteed sellable executable exits, and
   source discovery is not an unbiased all-launch sample.

### Fresh source-semantic risks found while wiring this bridge

- `packages/shark-intelligence-core/src/meme-trader/launch-outcome-engine.ts`
  currently permits outcome `RUG` when *both* severe reported liquidity
  collapse and high computed drainRate appear, even if `liquidityRemoved`
  was never explicitly observed as an on-chain withdrawal. Such a heuristic
  must not be represented to MemeBot/SniperBot or a user as a confirmed rug
  or accusation of creator misconduct. A future revision should distinguish
  an indicative severe-liquidity-risk class from verified transaction-level
  liquidity withdrawal, with independent corroboration and evidence provenance.
- `token-launch-ingest.ts` uses a module-scoped `Set` for duplicate IDs.
  That is a process-local convenience, not durable restart-safe deduplication.
  Actual deployment/prospective launch outcomes require database-level source
  IDs, replay-safe uniqueness, and reconciliation before learning or owner
  notifications.
- `paper-execution.ts` uses `status='FILLED'` on simulated paper orders,
  explicitly paired with `simulationAuthority='PAPER_ONLY'`. It must never
  be projected into the canonical provider-fill or realized-profit ledger;
  Money Core remains the owner of paper accounting/execution.
- The candidate builder's research-only `WATCH` and
  `assessmentToDecisionProposal` advisory `ASK` are not trade approvals.
  The new bot bridge deliberately returns `WATCH_PAPER` without even
  creating a hypothetical fill.

Repair tracks #1242/#1149/#1185 and the canonical Money safety gates
should be compared against newest main before certifying any fixes.
The 2026-10-15 SWLC Free-plan read-only storage incident and missing
verified original-history restore remain separate commissioning gates
(issue #1257 and history issue #1168). No destructive storage trim or
paid upgrade is authorized by this paper bridge.

## PAPER.01 → .04 implemented here

.01 Shared `bots-paper-context.ts`
- Restricts to Solana base58 mint/pair identities, 64-hex provided event hash,
  unique evidence references, observed<=available<=as-of and exact UTC syntax.
- Read-only result; marks its source identity as still unverified independently.
- Fails on future lookahead or mismatched source identifiers.

.02 `sniper-bot-paper-review.ts`
- Calls **existing** `assessmentToDecisionProposal` and consumes existing
  `PumpMigrationRadarCandidate`, never creates a new scoring algorithm.
- Cross-checks mint/chain, upstream evidence IDs and point-in-time availability.
- Returns BLOCK/DEFER/WATCH_PAPER only; migration BLOCK and canonical DECLINE
  dominate; missing canonical data defaults to DEFER; DEX-only inputs cannot
  pretend to be a canonical assessment; stale source (>15 min relative to asOf)
  cannot WATCH. WATCH is research-only and creates no order/fill.

.03 `memebot-paper-review.ts`
- Calls existing `reviewMemeDraft`, optionally existing `simulateMemePool`
  with explicitly owner-hypothetical assumptions.
- The SHARK research mint is a **comparison mint**; `proposedTokenAddress=null`
  until a real launch separately authorized and observed.
- Incomplete rights/allocations/liquidity/promotion disclosures BLOCK paper
  preview; valid checkboxes are self-attestation, NOT independent legal/IP proof.
- Zero wallet, mint, deployment, payout, revenue or external message.

.04 `shark-bots-paper-cycle.ts`
- Uses the **same** validated source record for both specialist outputs.
- Produces a deterministic same-case packet with no action/permit, no money,
  no live execution, zero fills/launches, unscored prospective outcome status
  and explicit limits on source authenticity claims.
- No write to Supabase, account, live API, GitHub study branch, SHADOW memory,
  telegram, token launchpad or provider. The existing canonical outcome pipeline
  may consume verified future evidence only after separately implemented proof.

## Acceptance checklist and future code

- Exact-head web app Vitest/typecheck/launch-gate CI; source-only changes.
- Negative tests for future data, bad mint, incompatible chain, stale market,
  high risk, missing canonical score, missing disclosures, hypothetical scenario
  misuse, repeated identical packets and mutation attempts.
- Separate PR #1409 remains a prerequisite only for longitudinal 7-day final
  collector changes; these specialists do not depend on it or alter the ledger.
- SHARK-BOTS.PAPER.05–.08 (future): connect actual bounded Money Core paper
  execution and MEME-VENTURE prospective scenario cohorts, real later outcomes,
  idempotent persistence/queue retry and source-verified memory projection.
- SHARK-BOTS.LIVE: no authorization implied. Commission only with independent
  risk and legal review, explicit owner grants, a small isolated budget,
  daily-loss/exposure/launch caps, revocable signer, kill switch, actual
  provider receipts, staging/canary, and independently verified deployments.

No claim of profitable sniping, safe tokens, real launches, funded accounts,
fully recovered history or a self-sustaining business is made.
