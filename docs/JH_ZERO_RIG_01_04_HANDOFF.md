# JH-ZERO-RIG.01 → .04 — no-rig earning research handoff

**Scope:** Opportunity Core research integration only; not a cryptocurrency miner, payment rail, node, bounty submission bot, or promised earnings.

## 01 — Method taxonomy
`zero-rig-methods.ts` catalogs bounties, mobile participation, bandwidth sharing, attention rewards, quests and paid API services. Existing phone/internet/software is still hardware. The taxonomy is **not** a second opportunity provider registry; approved providers are declared only in `provider.ts`.

## 02 — Superteam read-only scout
`zero-rig-superteam.ts` models the documented official agent listing API: `GET https://superteam.fun/api/agents/listings/live?take=20` with a caller-owned read-only transport. The module has **no fetch implementation** and no API credentials, login, agent registration, POST, claim flow or workflow scheduler. Only strictly OPEN, non-expired, AGENT_ALLOWED/AGENT_ONLY entries normalize. Everything stays unverified in canonical `Opportunity` records. Source truncation and malformed data are reported; API auth and real-world coverage are **not** certified. A reported 2026 listing-feed bug reinforces why every item must be independently checked against official details. Docs: https://superteam.fun/skill.md.

## 03 — Evidence-aware economic research
`zero-rig-economics.ts` calculates hypothetical expected USD per hour from prize estimate, win probability, labor time/value, compute cost and fees. If reward valuation, evidence, freshness, probability, time or costs are missing, the result is `insufficient_data`. No token-price quote is silently treated as USDC, and an assumed probability is not a proven win rate. `research_candidate` is not permission to execute.

## 04 — Bounty matching
`zero-rig-bounty.ts` gates candidates on evidenced skills, capacity, economics, eligibility, and deadline. If requirements or eligibility are unknown, the result stays in research. Matching has no side-effect capability.

## Architecture and outstanding gates
- Canonical Opportunity `provider.ts` and `source.ts` gain Superteam descriptors; discovery code projects into existing `Opportunity` with `verificationStatus: unverified` and `status: discovered`.
- No alternate Money Core, Opportunity registry, Action Executor, wallet, credential store, or database.
- Unresolved: credentials via approved secrets path; documented response-shape live canary; owner claim eligibility; current listing terms; real reward funding/fees; acceptance checks in real runtime; CI; exact-head migration/source reconciliation. No source-to-production polling, submission or settlement has been activated.
- External submissions, signups, purchases, claims, money transfers, proxy/VPN abuse, sybil farming, speculative airdrop automation, and paid resource consumption remain out of scope.

## Verification
`pnpm --filter @jhadina/opportunity-core type-check`
`pnpm --filter @jhadina/opportunity-core test`
`pnpm --filter @jhadina/opportunity-core exec tsx src/domain/zero-rig.test.ts`

## Next authorized coding target
JH-ZERO-RIG.05: **sandbox only** paid API contract research, provenance controls, per-request unit costs and deny-by-default exposure. JH-ZERO-RIG.06: existing Policy/Approval/Action/Safeguard paths. JH-ZERO-RIG.07/.08: read-only dashboard and paper experiment before considering any external action.
