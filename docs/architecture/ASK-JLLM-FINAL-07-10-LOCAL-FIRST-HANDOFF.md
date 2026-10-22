# ASK-JLLM.FINAL.07–.10 — Free/local-first model router and private acceptance
Date: 2026-10-22
Status: source implementation in draft PR #1484; owner runtime acceptance pending.

## Stack / preservation
- Base draft #1479 (.01–.03, frozen Ask fixes, WorkSession runtime OIDC client, hydration-safe iPhone links).
- Intermediate draft #1481 (.04–.06, typed visuals, model-state UI, limited opt-in Commons and visual source cards).
- Source recovery from #1364: existing Intelligence Fabric task classifier, `ModelRegistry`, `CapabilityAwareModelRouter`, local `LocalModelProviderAdapter` and their source tests; no duplicate model router.
- New small bridge `GovernedJllmModelRouter` implements existing `ModelProvider` for canonical `IntelligenceRouter`. Downstream policy, approvals, evidence binding, memory governance, Money, Director and Action Core remain unchanged.

## .07 — No hidden spending
- Default `JHADINA_REASONING_PROVIDER=local`, selecting only an explicitly configured local endpoint and model. Empty connection → classifier-only DEFER, not a fake successful answer.
- `anthropic` or `gemini` require an explicit environment selection (and credential). They never become fallback candidates because keys happen to exist.
- Capability routing refuses unsupported vision/research when no eligible bound model; it does not pretend it browsed external sources or executed tools.
- No provider can mutate Memory, approve an action, pay, publish, sign, or write a repository from a model proposal.
- Local Ollama JSON `POST /api/chat`, bounded context/reply, 20s timeout, nonstreaming, no model-proposed tool execution, request-scoped token and redirects disabled.

## Trusted local host boundary
For a Mac host in local development: serve Ollama on the same machine as Next.js, use `http://127.0.0.1:11434`, set `JHADINA_LOCAL_MODEL_NAME` to the model you installed.
**Do not expose a tokenless Ollama daemon to public internet or port-forward it.** Production Vercel `127.0.0.1` points at the Vercel container, NOT your Mac. Use a separate, approved, authenticated private HTTPS gateway with exact `JHADINA_LOCAL_MODEL_ALLOWED_HOST` and `JHADINA_LOCAL_MODEL_GATEWAY_TOKEN`. Gateways must independently handle abuse, rate limits, privacy, request logging and authentication; this source code does not create or certify one.
Model weights, local GPU/RAM and electricity are not cost-free, even without per-token API charges.

## .08 — Owner-only canary
- `GET /api/jhadina/model-status` exposes only configuration readiness after owner verification and no provider call.
- Owner presses `Test local reasoning` to `POST /api/jhadina/model-canary`. It denies cloud-selected and anonymous requests, sends only a fixed harmless instruction (no user chat/Memory), requires a schema-validated local proposal and discards raw model output. Canary verifies transport + schema only, not benchmark capability, model reliability, independent citations, or tool use.
- Never call the canary automatically or as a timer.

## .09 — Conversation continuity
- Existing WorkSession persistence (via #1479) is authoritative for session owner/id/goals/refs; it is NOT a full chat transcript.
- Bounded chat rows are saved as redacted browser-local data keyed by owner and WorkSession ID, restored on reload, locally searchable and user-clearable. This is device-specific, not encrypted cross-device conversation history; lost browser storage means lost local turns.
- No new Supabase schema, unseen migration, production DDL or external storage was created. A later separately reviewed, owner-scoped RLS transcript table and transactional storage is necessary before calling durable cross-device chats live.

## .10 — Canonical tools and acceptance
- Ask retains the existing read-only WorldRegistry tool directory and the current specialist command routes (Social, Growth, Sports, Music, Director, etc.). General model text is not a grant to call tools.
- Missing: universally authorized general source-grounded web retrieval, connected-account tool execution, transcript search across devices, code PR generation via Ask. Do not claim any of these as implemented.
- Acceptance: CI per exact head; real owner passkey iPhone; local Mac endpoint setup or private production gateway; owner canary; WorkSession save→GET→reload; provider attribution on every answer; negative cross-owner, spoofed-header, unsafe hostname, model JSON and unsupported modal/capability tests.
- Freeze / review: keep draft stacked, no production deploy, external payments, wallet signing, company account mutation, or live trades until separate approval.

## Status matrix
| Function | Source implementation | Live operational proof |
| --- | --- | --- |
| Capability-selected models | Implemented in PR | Pending CI |
| Private Ollama transport | Implemented in PR | Not yet connected |
| Owner-triggered local canary | Implemented in PR | No live run |
| WorkSession OIDC reliability | Source in #1479 | Authenticated save/reload pending |
| Device-local chat search | Implemented in PR | CI/browser pending |
| Cross-device full conversation library | Not implemented | Not available |
| Source-cited general web research | Not implemented | Not available |
| Universal tool execution | Not implemented | Not available |
