# OCE-AUTONOMY.ACTIVATE.15–.18 · Final source handoff
Date: 2026-10-22
Repository: bookieandco/crispy-waddle
Branch: feat/oce-autonomy-activate-15-18-20261022
Original draft PRs: #1472, #1474, #1477 (do not auto-merge or invalidate).

## .15 — reconciled source; merge still approval-gated
- Main at restack: dbb6b99c970451f89de2ebe7cddf9fdeccb113c2.
- PR #1477 head: 5db01a450d1891009b6baca3a8452ee1b7290f74.
- Exact file divergence: 35 Opportunity files vs **two unrelated new main files** (Ask Jhadina page and mobile QA script), no overlapping paths.
- Cherry-pick equivalent: create one new Git tree from latest main and selectively carry exact blobs of 35 audited Opportunity files. No force push, no main write, no loss of Ask/mobile changes.
- This branch adds activation verification and must pass exact-head CI before a reviewed release proposal.

## .16 — private iPhone readiness, NOT deployment
- Authenticated GET `/api/opportunities/commissioning/readiness` queries canonical owner-scoped Opportunity repository and checks the existing request-context Supabase privileged provider (no secret values exposed).
- Returns real owner records, public jobs, two-host research candidates, approved-host count, and explicit blockers. Even a green readiness response has `privateIphoneCertified:false` and `automatedDiscoveryAuthorized:false`.
- Workbench button shows verified account/readiness counts. Browser smoke validates narrow viewports and unauthorized API requests. CI mobile Chromium does not certify real iOS Safari, Face ID, or authenticated session.
- Separate owner authorization is required for an exact-commit private deployment. After approved deployment: on physical iPhone, check email-link login, passkey/Face ID, Home→Opportunity navigation, opportunity tabs, workbench preview, import, recovery, refresh, and logout access denial. Capture screenshots **without** user data/tokens.
- Privileged report routes use existing `createRuntimeServiceRoleClient()`, with Vercel request OIDC path and fail-closed missing configuration. No new secrets, no database migrations or auth bypass.

## .17 — real provider import preparation; production not imported
- Greenhouse and Lever public GET job-board adapters kept unchanged with fixed upstream hosts, no follow-redirect, bounded bodies and source identity.
- POST `/api/opportunities/discovery/jobs/batch` supports 1–5 owner-selected boards and preview/owner_import only. Response now includes grounded conservative preview title, host, location and explicit no-eligibility/no-AI-authorization flags, not invented candidate fit.
- On `owner_import`, the repository must return an owner-scoped canonical **read-after-write** record with the same stable ID and `applicationAuthority:NONE`; the response exposes `verifiedImports`.
- Identical existing opportunity may already be saved/pursuing; replay read-back **must not downgrade** human triage. Tests cover owner mismatch, no readback, forged authority and preview-only no DB writes.
- Greenhouse official documentation confirms public GET job endpoint and no GET authentication; Lever Postings API publishes GET endpoints. Those statements do not approve every individual employer's reuse terms or auto-application.
- Last read-only Supabase inspection: **0 total canonical opportunities, 0 employment rows, 0 multi-evidence rows**. No real owner import was performed from undeployed source.
- Commission a real import after owner approves exact source boards/provider use, the private release is approved, and the authenticated UI is tested. Verify repeated imports, DB read-after-write and owner isolation.

## .18 — governed source-verified research, recoverable reports
- Strict route `/api/opportunities/pilots/internal-run/from-opportunity` uses real approved public source refetch, actual excerpt match, 1MB per source bound, no redirected hosts, hash SHA-256 and two independently attributable hosts.
- Existing Agent Runtime records report hash and source hashes in the durable step output. GET `/api/opportunities/pilots/internal-run/[runId]` reads authenticated owner-scoped run, checkpoint, step output, verifies report digest, returns report for iPhone copy/recovery.
- Older arbitrary-observation endpoint `/api/opportunities/pilots/internal-run` is now closed with 409, preserving fail-closed provenance.
- The interface provides a manual saved run-ID restore field, so a report can be recovered after app refresh/restart; no browser localStorage tokens or new competing work queue introduced.
- `OCE_RESEARCH_ALLOWED_HOSTS` is intentionally empty in sample config. Only add explicitly authorized public exact hosts in server env. Do not use arbitrary URL fetch or platform bypass.
- Real pilot remains blocked until at least one genuine owner-owned Opportunity has two canonical referenced excerpts from two approved hosts, with independent factual QA. Synthetic tests are not production evidence.

## Test and release acceptance
1. Obtain green exact-head Opportunity Core CI, Agent Runtime CI, Launch Gate, Web Conformance, and Private Mobile Browser QA.
2. Review new consolidated PR; do not merge #1472/#1474/#1477 in addition and accidentally apply duplicate patches.
3. Separate owner release authorization; verify exact project, branch SHA and preview protection before private deployment.
4. Real iPhone authenticated canary: login, Face ID, Opportunity controls, reload, no stale auth, no unauthenticated read/write access.
5. Read-only preview of permitted real public boards; import 1–5 selected boards under owner's approval, verify canonical writes and human eligibility checks, no applications.
6. Two owner-reviewed current public source excerpts and allowlist; create a report, recover after browser restart and verify report hash/receipt; independent factual QA.
7. Only after separate owner standing authorization may a recurring scheduler be installed. All external delivery, applications, customer outreach, purchases, payments or earned-income claims remain out of scope.

## Evidence/authority separation
- SOURCE_IMPLEMENTED: source merged into branch, not to main.
- CI_VERIFIED: only if the exact final SHA passes GitHub workflows.
- RUNTIME_CERTIFIED: not claimed here.
- PRIVATE_IPHONE_CERTIFIED: not claimed here.
- REAL_IMPORT_PERSISTED: not claimed here.
- REAL_PAID_JOB: not claimed here.
- No merge/deploy/spend/sign/contract/apply/contact/activated cron was performed.
