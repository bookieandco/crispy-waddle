# SOCIAL-FREE.06–.16 — implementation and commissioning, October 16, 2026

## Scope and verification
Free-first clean-room recreation of practical workflow concepts from Social Cat (collaboration matching), Stack Influence (product seeding, creator/UGC tracking), and Realize (creative analysis). **Not** a copy of private services or ad inventory. All external actions and financial movements disabled.

### Code delivered by milestone
- **.06** Reconcile original PR #1310 source to a branch created directly from current main. Retain all latest Growth exports and original Social page, add links only.
- **.07** Migration for `public.jhadina_creator_campaign_records` with canonical SWLC Supabase Auth ownership, explicit RLS, FORCE RLS, unique import keys, audit revision, check constraints, no anon access, and zero action/money authority. Authenticated Next.js API with same-origin writes, request size limits, ownership through server identity+RLS, optimistic locking and archive.
- **.08** Manually acquired source-tagged creator imports (100 max), consent marker, opt-outs, deterministic dedupe. Existing leads are never overwritten by future imports. No scraping or automated DMs.
- **.09** Personalization and immutable-text fingerprint **draft only**. Requires creator evidence, eligible contact and prior consent. Sending routes remain to original Growth outreach -> Social -> Action Core, not implemented as a side channel.
- **.10** Evidence-required, monotonic collaboration stage planning; owner can store collaboration records, not dispatch shipping or mark receipts verified.
- **.11** Scoped UGC license checks (existing creator-marketplace module) with expiry, revocation, exact requested use. Mobile UI saves *unverified reference drafts*, not a new license grant.
- **.12** Reuses Growth economics, accepts manual order-evidence references, reports after marketing costs only when supplied actual observed outcomes. Manual outcome records marked unverified; no fabricated Shopify attribution.
- **.13** Director creative brief planning with disclosure/rights/QC checklist and mediaGenerated=false.
- **.14** No-budget organic ad-study plan, existing Growth A/B/paid controls remain the exclusive governed paths. Does not use Realize paid publisher inventory.
- **.15** iPhone-friendly /social/collaborations screen with estimator, creator input, rights preview, account-scoped saved drafts, manual import, and outcome entry. Requires runtime database.
- **.16** Regression tests, live organic pilot acceptance criteria below. **A real 5-creator outreach pilot and real transaction attribution are not automatically certified by a code PR.**

### Live blockers (verified)
- October 16 SWLC project `kqbkaozfjubkjevdfvic`: database connection refused with PostgreSQL `57P03` / `database system is not accepting connections` when attempting read-only table listing, migrations and security advisors. Control-plane listing reports ACTIVE_HEALTHY but it is **not** evidence of a working database. Migration deliberately **not applied**.
- Pending Social identity and weekly approval PRs #1299 and #1136 are **not merged**; preserve them as donors and do not authorize a parallel messaging/scheduler path.
- No verified Shopify order receipts or creator opt-ins provided to this build; no outreach, sample dispatch, contracts, ad purchases, or measurable real pilot executed.

### Safe commissioning after recovery
1. Verify exact SWLC project and live Postgres `select 1`; inspect migrations and existing schema. Check no alternate creator table exists.
2. Apply `20261016140000_jhadina_creator_campaign_records.sql` through canonical migration flow only once, inspect RLS grants and authenticated two-owner isolation using real test accounts; verify anonymous and cross-owner requests are rejected and optimistic revisions conflict.
3. Run `pnpm --filter @jhadina/growth-core test`, `pnpm --filter @jhadina/growth-core type-check`, `pnpm --filter @jhadina/jhadina-web type-check`, web build and review all GH workflows on exact PR head.
4. Open `/social/collaborations` in authenticated iPhone portrait view. Verify a saved manual record persists after reload, opt-outs survive import dedupe, tampered origins are rejected, and missing database fails closed (503).
5. Conduct owner-approved, consent-based **organic** pilot with five pet creators for PupsonStuff. Never claim they are recruited in advance; record verified opt-in and every actual cost.
6. Review a real content approval and signed reuse rights, record shipped goods and verified final posts and Shopify order IDs, compute contribution margin, CAC and returns. For a pilot with no verified orders, report `INSUFFICIENT_COMMERCIAL_EVIDENCE`.
7. Use existing Social/Action Core approvals for publication; authorize no auto DMs, ad budgets or sample purchases by importing this feature. Release as read-only/draft until each gate is passed.

### Non-goals
No proprietary brand presentation copied; no gated creator directory data extracted; no claims about sales or guaranteed UGC; no paid media commissioning or hidden API integration. Local preview and source CI cannot substitute for live user/device/backend verification.

## SOCIAL-FREE-LIVE.04A — explicit preview-only boundary

The source implementations above remain preserved, but POST/PATCH and import POST now
unconditionally return 503 `SOCIAL_FREE_NOT_COMMISSIONED` before parsing, session
resolution, or storage access. This denial has no environment/header/body override.
GET retains its owner-authenticated read-only behavior. No migration is applied.
Database recovery alone cannot enable these application write routes.

The actual collaboration page disables all save/import/stage buttons and guards their
handlers independently. Estimates are in-memory and cleared on reload. Read-only
reload reports unavailable storage honestly; it does not fabricate saved records.

Verification introduced:
- 15 route tests: owner A/B, anonymous, forged header/body/environment commissioning
  claims, and malformed input, across create/update/import. A healthy mocked client
  must receive zero calls; no identity/session resolution or body parsing is needed.
- Actual component Chromium fixture at 390 and 375 pixels: evaluate an estimate,
  keep all eight save controls disabled, zero mutation/external requests, unavailable
  read-only reload, no horizontal overflow, and no persistence across page reload.
  Screenshots and JSON receipt are retained by UX Final Certification.

These are source/fixture checks, not real iPhone Safari or live two-owner RLS proof.
The prior 12/12 CI and READY preview receipts apply only to `00a45c310b94`, not this
follow-up head. Require the new exact-head CI and browser receipt before accepting .04A.

Outstanding: exact SWLC recovery, schema reconciliation and migration, live owner/anon
RLS and revision/dedupe checks, authenticated iPhone acceptance, canonical immutable
approval reconciliation, verified opt-ins/posts/orders/refunds/costs. Keep #1328 draft.
Do not merge superseded #1310 or wholesale-import #1136/#1299.
Manual evidence strings still do not establish independently verified sales; receipt
admission is a separate follow-up. No real ROI or pilot success is certified here.
