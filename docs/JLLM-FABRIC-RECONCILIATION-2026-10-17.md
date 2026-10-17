# JLLM-FABRIC-RECONCILE.01–.05 — selective, no authority change

Audit date: 2026-10-17
Main base: `8b07be5a71f915bb39e0d58f732afc6e533b32f7`
Historical branch: `jllm-01-intelligence-fabric`, head `5bb12fae718aa86ebd29ae20f4cbd311bc2b851f`.
Historical compare at initial audit: DIVERGED (271 ahead / 7,167 behind; 147 changed paths). Do not merge the old branch.

## .01–.03
- Restored model registry, deterministic task classifier, capability-aware routing, and governed proposal-only Intelligence Fabric from the old branch.
- Retained modern main's Anthropic and opt-in Gemini identities; no change to the deployed `createProductionIntelligenceRouter`.
- Missing trusted privacy classifications now default to `restricted`, rather than the historical `internal`. Neither default external model admits `restricted` data.
- Routing is opt-in behind a trusted caller: metadata is not permission to transmit bytes externally or grant tools, approvals, execution, or durable memory changes.

## .04–.05
Recovered read-only hybrid retrieval, authorization-before-reranking, critic downgrades, inference-ledger metadata, and a new strict verifier based on current evidence binding. Added negative tests for mutated reranker payloads, foreign owner substitution, fabricated evidence and raw-prompt persistence. These are source-tested primitives, not wired to the active Ask route. Do not import the old `evidence-verifier.ts`: main's `evidence-binding.ts` has since added Social, Growth, Money, personality and artifact provenance. Do not restore old Supabase asset tables, buckets, SQL migrations or an additional Action/Memory plane.

## Voice correction
Progressive NDJSON voice audio streaming exists in current main in `services/jhadina-voice/worker.py`, `app.py`, the authenticated web proxy and Ask playback. Live upstream synthesis interruption, iPhone first-chunk timing, canonical acoustic quality and two-provider acceptance still require physical evidence.

## Release gates
Source tests and exact-head CI are necessary but insufficient. This recovery is non-production and not merged; local inference, persistence writes, Supabase migrations, provider spending, voice release, and cross-owner data are not commissioned.
