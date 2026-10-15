# PUPSON-AUDIT.01–.03 / PUPSON-DEPLOY.01–.03 — exact-base handoff
**Date:** 2026-10-14 America/Los_Angeles  
**Repo:** bookieandco/crispy-waddle  
**Audit base:** `0f9040e0a93003379533112d6eb157b1e523e820`  
**Status:** evidence freeze and change proposal; deployment remains externally blocked, not certified.

## AUDIT.01 — reproducible baseline
- Main commit above is the *frozen comparison basis*, not a guarantee the fast-moving main branch still points to this SHA.
- `scripts/verify-original-assets.mjs` verifies Git blob SHA-1 and byte length for the original boutique photograph and six approved/runtime GLB pairs. `config/original-boutique-assets.json` freezes GitHub's exact file-object hashes.
- The verifier is content-based; pass is not a substitute for mobile pixels, 3D model correctness, licensing or deployed E2E.
- `.github/workflows/pupsonstuff-ci.yml` gains `workflow_dispatch` so main can be manually tested at a chosen head without unrelated source changes. The PR itself runs the gate.
- Exact-current-main CI remains unverified until separately run on the then-current main SHA; PR CI belongs to the PR commit.

## AUDIT.02 — PR lineage and unique-change dispositions
- #888, #1158, #1159, #1160, #1161, #1164: merged canonical work. Do not duplicate.
- #195 (old Pet Identity): diverged, 26 commits ahead / 7691 behind frozen main by GitHub compare. Legacy up-to-five-photo path conflicts with canonical max-three; do not merge. Existing newer creative job, consent and pet identity contract prevail. New delta, if needed, must be manually ported with new tests.
- #537 (media): diverged, 41 ahead / 3377 behind. Contains a historical Roboflow vision proposal and gateway work. The present Railway gateway already has successful deploy history; do not redeploy historical services. Examine `roboflow-dog-vision.ts` as a *possible* additive feature only after current API, privacy, vendor policy and tests are checked.
- #1000 (Printify recovery): diverged, 20 ahead / 1284 behind. Critical `submission_unknown` and provider-order recovery were forward-ported by merged #1158; current Supabase migration `20261008162804` is recorded applied. Old branch does not need merging.
- #96 (old repository import): open legacy source; original app integrated via merged #9/#48; do not merge blind.
- #199 (AI POD): an independent `apps/ai-pod` store. Not a PupsonStuff change and must stay separate.
- Compare status is not proof each changed line is unique: GitHub compares divergent commit branches, so manual context review is needed before any cherry-pick.

## AUDIT.03 — original-vision lock
- The canonical customer store is `public/boutique.png` + silhouette-aligned hotspots and full-height mobile panning, not a generic product grid.
- Six frozen GLBs: shirt, hoodie, mug, pillow, bottle, tote; canvas remains procedural.
- `boutique_shell.glb` is an unfurnished architectural blockout; `boutique_proxy.glb` is rejected. Neither may silently replace the photo.
- Manual phone/desktop screenshot pixel alignment, tap-map, product lift, 3D decals and accessibility tests remain acceptance gaps.

## DEPLOY.01 — dedicated hosting
- Connected Vercel team: `bookieandcos-projects` (Hobby).
- Attempted `POST /v11/projects` for a separate `pupsonstuff` project using `apps/pupsonstuff`, Next.js, preview-only/dry-run flags, no Git auto-connect and no secrets. Vercel returned **403 permission denied**; no project created. No changes to `crispy-waddle-jhadina-web`.
- No Vercel CLI is installed in the runtime; mapped CLI fallback cannot be executed here.
- Requires owner-side Vercel permission correction / documented authorized project creation. Do not silently substitute the Jhadina project.

## DEPLOY.02 — configuration / safety gate
- Scope project root to `apps/pupsonstuff`, Next.js, with monorepo workspace dependencies included; isolate all environment variables per project.
- Keep `PUPSON_FULFILLMENT_MODE=dry_run`, `PUPSON_LIVE_COMMERCE_APPROVED=false`, `PUPSON_PAYMENT_OPERATIONS_READY=false`.
- Avoid attaching `www.pupsonstuff.com` or accepting Stripe live payments in preview.
- **Additional blocker:** existing `vercel.json` defines `*/5 * * * *` internal creative cron. On the Vercel Hobby plan, sub-daily cron expressions are rejected at deploy. Preserve the needed work cadence: approve a separate supported scheduler or a new deployment arrangement; do NOT weaken it without an explicit engineering decision.
- Secrets must be set via an authorized private channel. Never store credentials/customer images in the repository or CI logs.

## DEPLOY.03 — real preview verification
- Existing `pupsonstuff-preview-canary.yml` provides a read-only manual smoke workflow for a dedicated `*.vercel.app` preview; it tests `/api/health`, app identity, dry-run state, and storefront HTML.
- No preview URL exists; cannot claim canary pass, real AI generation, Stripe paid test, physical sample proof or customer launch.
- Once a preview is deployed, run that workflow with actual URL and exact deployed commit. Record results / HTTP status / timestamp / SHA, then run 1- and 3-photo creative tests and Stripe TEST signed webhook against an authorized private environment.

## Exit criteria
- **Audit code target:** this PR's integrity regression and type-check/test/build jobs must pass on its exact head; then merge/re-run on current main.
- **Deploy target:** independent project ID, correct root, approved scheduler, preview URL, healthy authenticated data boundary, green read-only canary and no money/funds flow.
- **Live commerce remains BLOCKED** until sample_verified variants, real test receipts, provider margins, monitoring, support/refunds and explicit owner approval.
