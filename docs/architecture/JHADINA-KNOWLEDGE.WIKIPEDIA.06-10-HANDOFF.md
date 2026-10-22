# JHADINA-KNOWLEDGE.WIKIPEDIA.06–.10 — source reconciliation / acceptance handoff

Prepared 2026-10-22 (America/Los_Angeles). **Source-only draft; never claim production deployment or real iPhone acceptance without receipts.**

## Exact-head reconciliation (.06)
- Baseline main: `dbb6b99c970451f89de2ebe7cddf9fdeccb113c2`.
- Wikipedia #1482: `ed6ab858dcb30f41b7df903e7514b18dd7b7df84`.
- Ask reliability #1479: `d38f300bd8fe68e48044dc1bbdb897222e2ee746`.
- Integration merge commit: `7c4fa174250e1308dc338d68a80487a56f24602b`, with both above heads as parents. Original changed paths do not overlap.
- Draft convergence PR #1488 targeting main. Do not merge unrelated donor branches, discard either PR, deploy or promote production silently. The main and older draft PRs remain unchanged.
- After any future main head advance, recompute compare and resolve drift before merge.

## Live Wikimedia certification (.07)
- Automated network-level smoke: `apps/jhadina-web/scripts/wikipedia-live-smoke.mjs`, run via `.github/workflows/jhadina-wikipedia-live.yml` in GitHub Actions on PR or manual dispatch.
- Searches `Ada Lovelace` through the **Action API** for plain-text excerpt, canonical URL and revision/time; then calls `action=parse` for wikitext and external citation candidates. Identifiable Wikimedia User-Agent and no logged article body. Live upstream checks are independent of mocked adapter tests.
- No access to live external network from the sandbox container; successful GitHub Action is required evidence. Do **not** claim live certification until the workflow concludes successfully. A 429/5xx or upstream outage is an honest blocker, not a pass.
- RESTBase `/api/rest_v1` is legacy; avoid new dependence. Use Action API and consider contemporary REST `/w/rest.php/v1` as a later adapter.

## Research & primary-source comparison (.08)
- On-demand owner-authenticated `GET /api/jhadina/research/wikipedia/article?pageId=...` inspects article metadata, raw reference snippets, and up to 12 links; no user URL is fetched by this endpoint.
- On-demand owner-authenticated `POST /api/jhadina/research/wikipedia/review` re-fetches the Wikipedia page server-side; accepts a **page ID and a selected reference index**, never a caller-controlled fetch URL.
- Public comparison fetches only selected allowlisted institutional HTTPS hosts; bounded time, streamed bytes, response types, redirects denied, no cookies. Returns `POTENTIAL_ALIGNMENT` or `NO_ALIGNMENT` **without** ever emitting a verified fact; superficial token overlap is not independent source authentication, factual corroboration, or primary-evidence admission.
- High-stakes claims must be checked against original primary evidence and reviewed with explicit provenance. No autonomous universal claim-verification engine is claimed. Wikipedia and independent-source raw text are untrusted external input.

## JLLM, citations and session continuity (.09)
- The production Ask composition remains canonical Context Builder + K-1.5 + governed model/policy/approval. A request-local research callback adds a typed public-research receipt to the Ask response; it has no execution authority.
- The UI renders article title, bounded summary, revision-specific clickable link, retrieval date, license notice, uncertainty label, owner-only citation inspection and selected institutional comparison. No automatic navigation to outbound reference links.
- Existing owner-scoped WorkSession reuses the same goal/session flow and persists simple `wikipedia:<pageId>:<revision>` *output references* plus `research` subsystem, **not** article text or a second Knowledge/Memory store. Saving remains save-only retry; new commands must not be replayed for persistence failures.
- Citation receipts are user-visible source references, not model-generated proof that an excerpt was used in the answer. They must remain clearly separated from internal "Verified response" (which refers to governed command completion, not external fact checks).
- Controlled Knowledge admission remains existing approval-gated architecture; this change does **not** auto-ingest public article material into personal Memory.

## Mobile / security / private owner acceptance (.10)
Source QA is run by existing `apps/jhadina-web/scripts/qa-jhadina-mobile.mjs` against 390×844 and 320×568 Chromium emulation, with extra UI-source regression tests in `wikipedia-research-card.test.tsx`. Chromium is **not** a physical iPhone/Face ID receipt.

Before enabling on a live device:
1. Inspect exact-head CI: workspace build, lint, TS, Vitest, JLLM, UX, and mobile; reject any failed or stale checks. Verify live MediaWiki workflow too.
2. On the **separately approved, authenticated private preview** (not public production), sign in with the owner's email link and enroll device passkey/Face ID. Ensure no auth bypass or reusable OTP/password.
3. Confirm Home → Ask → Work → Worlds → Home navigation works on physical Safari including history/back, narrow portrait and post-refresh.
4. Ask “Who was Ada Lovelace?”; confirm attributed article and revision URL, reference inspection and 429/unavailable handling, stable tap targets, no infinite loop, and no citations falsely treated as fact verification.
5. Ask “Continue my previous project”; confirm no Wikimedia request and WorkSession owner scoping; save, reload, retry **saving only** after a simulated failure, and ensure no command/action re-executes.
6. Test on two accounts that WorkSession and other owner data cannot cross owner boundaries. Confirm external references cannot cause server SSRF or arbitrary tool execution.
7. Record the actual device/build URL, date, owner result, and rollback plan. Until this is performed, mark private iPhone acceptance **PENDING**, not pass.


## Subsequent review: 2026-10-22
- **Actual Vercel project inventory (read-only):** Connected project `crispy-waddle-jhadina-web` returned **zero** deployments when filtered by `feat/jhadina-wikipedia-converge-06-10`. This is not a ready/owner-authenticated private preview. No deploy action was performed.
- **Intent privacy regression repaired:** `Tell me about Ada Lovelace` must be allowed even though the conversation framing contains the word `me`; the extracted query `Ada Lovelace` remains subject to private-information filtering. Added a regression test.
- **Verification label clarified:** When Wikipedia evidence is included, Ask presents a completed request without suggesting the community-edited excerpt was independently fact-checked.
- **Acceptance unresolved:** Compare PR #1488 current head with GitHub Actions run SHA; `wikipedia-live-api` and full build/type-check/Chromium must pass at that exact head. No owner physical Safari/Face ID session has been exercised and no current preview URL was found.
- **Explicit release boundary:** The user must separately authorize a private deployment or promotion after code/CI review; do not assume a successful build created a deployed preview.

## Required approval boundaries
- No production rollout, password/passkey enrollment on user's behalf, manual session impersonation, paid providers, spending, publishing, wallet signing or independent live actions in this sequence.
- PR #1488 must remain **draft** until latest-head CI, live upstream check and explicit release decision are reviewed. Main not changed.
- A mock/test success is not operational proof for Wikimedia uptime, public-source accuracy, session durability in production or biometric login.

## Coding and test entry points
```bash
pnpm --filter @jhadina/jhadina-web test -- src/lib/research/wikipedia-research-provider.test.ts src/lib/research/wikipedia-article-reader.test.ts src/lib/research/wikipedia-primary-review.test.ts src/app/ask-jhadina/wikipedia-research-card.test.tsx
pnpm --filter @jhadina/jhadina-web type-check
pnpm --filter @jhadina/jhadina-web build
node apps/jhadina-web/scripts/wikipedia-live-smoke.mjs
```
