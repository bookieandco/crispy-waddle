# MUSIC-JUGGERNAUT.MOMENTS.01 → .05 — source handoff

**Date:** 2026-10-21. **Canonical repository:** `bookieandco/crispy-waddle`.
**Stacked dependency:** recovery PR #1443, branch `recover/music-juggernaut-01-08-20261021` at `90b56bc8eace5f78d152b1c486dd2522a8ba1f74`.
**Status:** source-only implementation; real provider/audio/device acceptance is outstanding.

## Canonical selection
The public Atwood Bookie catalog seed identifies `Moments` on **Boo Hefner Spring 2022**, April 16, 2022, with the existing Apple Music album reference. This is a public catalog match, NOT documented master ownership, publishing/sample clearance, source audio availability, stream analytics, or authority to publish.

## Implemented sequence

| ID | Source implementation | Evidence necessary for live operation |
|---|---|---|
| .01 | Exact title/release matched through existing commissioning catalog. Owner-scoped Music project match must be unique. | A single owner project song record, not a guessed ID |
| .02 | Real Music `SongSection` ranges matched against an owned-audio SHA-256 and analyzer receipt; rights record must match same song and all ownership/clearance fields. | Owned source audio, measured sections, explicit rights/supporting receipt |
| .03 | Three distinctive Music Content Factory brief variants for canonical Director, all pinned to the proved section when one exists. An asset is considered approved only when job, preview, hash and independent approval proof match one of those briefs. | Real Director render SHA, preview and human approval bound to exactly one version |
| .04 | A Social handoff remains a proposal, conditional on approved Director media, account-bound child approval, outbox ID and provider post readback. The Growth Ads concept carries **zero spend** and explicitly requires the existing Growth budget, policy and approval system. | Authenticated account, independently consumed approval, provider post ID/readback; ads separately approved |
| .05 | Only two distinct, provider-matched, same-experiment outcome observations with acceptable bot risk, positive song actions, attribution confidence and exposure can form a proposed creative learning signal. | Real provider measurements and canonical learning admission; independently demonstrated next-brief change |

## Integration boundaries
- `packages/growth-core/src/music-juggernaut/moments.ts` composes the existing Music Content Factory and catalog commissioning. It does **not** create a new ad executor, renderer, Social publisher or ledger.
- `GET /api/music/juggernaut/moments` is protected by the existing owner identity verifier, uses the Music project projection and never writes. It deliberately leaves Director/production/readback inputs null until separately verified.
- `/music/juggernaut` adds an iPhone-readable Moments panel alongside the already staged recovery gates.
- A code-level `pilotEvidenceMatched` result is **not** live deployment proof: `livePilotVerified` is always false in this source-only contract. A real operator/device/provider canary is still necessary.
- In live data audited October 21, the artist has 83 catalog songs but zero populated measured sections, zero verified rights-cleared song selections, zero connected Social accounts, and zero attributable observed campaigns; no live Moment is yet cut, published, advertised or proved.
- No source license, rights grant, artist impersonation, GPU job, paid campaign, spending, fan message, publication, provider token access, migrations, deployment or external API action was performed.

## Exact-head acceptance
1. Reconcile stacked branch against recovery PR #1443 and latest `main` before merge; do not transplant old unmerged Social identity implementations.
2. Run Growth Core `type-check` and `test`, Web `type-check` and the main PR CI workflows. Validate owner endpoint returns 401 without session, no user-scoped leakage and no writes.
3. Bind verified owned audio analyzer receipts to the `Moments` sections and a rights record.
4. Obtain one approved, real Director rendered asset and authenticate one publishing account through canonical Social.
5. Create an actual child-approved Social proposal only through canonical Social interfaces; reconcile provider readback and observations, then separately review any Growth Ads budget proposal.
6. Verify the next brief changes only after replicated, qualified evidence; record independent private iPhone acceptance. Do not claim release success without those receipts.

**Current acceptance:** five coding targets are staged with fail-closed proof boundaries. Production activation remains blocked by missing external evidence and integration certification.
