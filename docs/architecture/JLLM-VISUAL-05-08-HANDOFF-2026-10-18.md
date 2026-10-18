# JLLM-VISUAL.05–.08 — bounded visuals, photos and educational interaction
Date: 2026-10-18

## Relationship and boundaries
This work is stacked onto PR #1391 (JLLM-VISUAL.01–.04). It must not be merged directly to an unrelated main commit or silently overwrite the parallel JLLM Intelligence Fabric recovery PR #1364. The original command, verified identity, canonical decision, evidence binding, action policy, approvals, Memory and Supabase paths remain unchanged.

## .05 — public image exploration (source-code complete, live acceptance pending)
- Introduces read-only \`GET /api/jhadina/visual-media?q=...\`, using the same owner/session verifier already used by Ask.
- The owner must type a **public** search and press Search; no automatic forwarding of prompt, personal chat, attachments, identity, secrets, or internal context to Wikimedia.
- Commons Action API generator search (File namespace), imageinfo mime/url/thumbnail/selected extmetadata. Max six results. Static provider origin, bounded query/response, seven-second timeout, no redirects to arbitrary hosts via user input, restricted raster image URL + Commons source page + recognized CC/public-domain metadata + license URL.
- Revalidates the returned gallery on the browser. Every candidate visibly names the source and license; results never establish the truth of an answer or even the relevance of a photo to the user’s requested location or person.
- No generic web-scraping capability, no API credentials or third-party SaaS payment, no persistent storage.

## .06 — deterministic tactile simulator
- Adds one real touch/keyboard slider exercise for *association football offside position*, with attacker, ball, and second-last defender locations represented on a normalized field.
- Deterministic position rule is deliberately not an offside **offence** verdict. The simplified representation omits active play, relevant player body parts, other players, exception restarts and other official-law nuance.
- The hardcoded explanatory source is [IFAB Law 11](https://www.theifab.com/laws/latest/offside/).
- There is no model-generated executable simulation code. New domain simulators should have independent deterministic rules, licensed data, and tests before admission.

## .07 — governed planner and renderer
- Deterministic \`VisualResponse\` gains allowlisted \`simulation\` kind and \`mediaDiscovery: OWNER_TRIGGERED_COMMONS\`.
- Visual kind is admitted only after JLLM identity/decision verification and an explicit visual user intent; all arbitrary/unknown properties are dropped by the UI parser.
- Media results are kept **outside** the governed claim/evidence structure and displayed as candidates. No emitted HTML/JS, calls to external executors, fund movement, publishing or capability escalation.

## .08 — certification status and real-world gates
Source tests added:
- URL/host/path/mime/license/attribution allowlists, explicit-query network boundary, upstream failures and rejected unsafe payloads;
- offside own-half, level, behind, ahead and invalid-state boundary tests;
- photo/simulation admission and unverified/declined refusal.

Exact-head required before merge:
1. Web type-check, full web unit suite and production build; JLLM runtime, interaction-quality, UX, Security/Launch and deploy conformance CI.
2. Server owner-auth GET 200, missing-session 401, cross-account 401, malformed query 400, Wikimedia unavailable safe error/no data leak.
3. Real iPhone Safari: portrait layout, landscape, dark mode, screen reader labels, range keyboard/VoiceOver adjustment, photo swipe/next/back, timeout/offline/blocked image fallback, typed search consent and no private prompt leakage.
4. Live Wikimedia probe with source URLs, accurate attribution and allowed licenses, screenshot/video/manual acceptance evidence.
5. Reconcile PR #1364's competing Ask page work after it merges, retest exact merged head, and approve any privacy-network egress requirements before deployment.

**Do not mark .08 LIVE/FINAL until a signed-in physical-device acceptance and a genuine upstream source probe are recorded.** GitHub CI success alone is code validation, not completed live commissioning.

## Follow-on
JLLM-VISUAL.09+ should add owner-approved SVG/canvas visualization grammars for additional domains (maps when grounded, timeline/graphs when sourced), short screenreader audits, and optional in-session state continuity—still no arbitrary model code or execution.
