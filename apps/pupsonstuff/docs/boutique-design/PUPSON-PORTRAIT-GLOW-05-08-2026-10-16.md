# PUPSON-PORTRAIT-GLOW.05–.08 — Mobile proof and Cloudflare propagation

**Date:** 2026-10-16

## Grounded baseline
- PR #1326 merged `b95caf69074e6e630d0896fe41f40f0af8d23cb2`; initial PR and post-merge PupsonStuff, spatial and local Cloudflare workerd checks passed. Public Cloudflare preview still served **earlier** source commit `14df934` at last review, so owner-reported screen defects have **not** yet been retested with the repair.
- Initial first deployment returned Worker URL but first immediate read-only canary failed; minutes later a separate GitHub read-only probe verified health 503, home 200 and checkout 503 on the uploaded older Worker. This establishes a transient propagation failure, not that a specific HTTP status happened at first failure (the old canary log didn't capture the observed status).

## .05 — Remote canary fail-closed retry
- Bounded 8 attempts, 8-second delay and strict 40-char source SHA proof.
- Retry only a **read-only GET** after: known transient edge HTTP statuses, old-but-safe commit, timeout or network propagation errors.
- Never retry a 200 health endpoint, unexpected identity, bad URL, missing safe checkout block or commerce guard bypass.
- Continue failing if propagation never resolves, instead of claiming the upload is healthy.

## .06–.07 — Actual browser viewport proof
- Run Next.js with all preview-commerce flags disabled and no cloud account tokens.
- Launch headless Chromium at iPhone-size portrait 390×844 and 430×932, landscape 844×390 and desktop 1440×900.
- Assert canonical image dimensions, shared hotspot coordinates, no body overflow or 1.55× glow rings, portrait overview/explore toggle, horizontal pan and department navigation.
- Upload screenshots as **short-retention PR artifacts**. This is Chromium viewport emulation, **not** real iOS Safari hardware or touch hardware verification.

## .08 — Guarded handoff
- No Cloudflare Worker upload through this PR; deployment still requires owner to manually select `DEPLOY_VIEW_ONLY_FREE_PREVIEW` from main workflow.
- Post-deployment evidence must show exact new source SHA with health fail-closed, homepage 200 and blocked checkout. Only then compare owner's portrait screenshots to the original room and fine-adjust any individual item masks.
- Preserve frozen `boutique.png` / approved GLBs. No customer data, payment approval, Supabase keys or Printify access is added.
