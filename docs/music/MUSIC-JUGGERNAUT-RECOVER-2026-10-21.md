# MUSIC-JUGGERNAUT.RECOVER.01 → .08 — source reconciliation and live gates
**Audit:** 2026-10-21. **Canonical source:** `bookieandco/crispy-waddle`, started at `main@8e3ffebfed8ad6dd1707436173c97b6e682ed480`.
**Scope:** Atwood Bookie / one existing artist project. No merging, deployment, production database mutation, publishing, paid media or external-account linking.

## Preserve the real foundation (.01)
- **Merged, not rebuildable from old draft:** #833 core, #859 adversarial source certification, #964 hourly autopilot, #1294 selective Music hardening. Existing Music/Director/Social permission boundaries remain authoritative.
- **Not merged:** #1299 weekly Social parent-and-independent-child approvals, #1408 Music streaming recovery, #1421 → #1429 restoration/DAW prototype stack, #1430 → #1436 Social identity/security recovery. All require separate current-main reconciliation and CI; do not merge the legacy Social Juggernaut stack wholesale.
- Independent YouTube Music Topic work is preserved on `feat/music-juggernaut-youtube-topic-20261021`, not silently included in this recovery branch.
- This recovery adds only a read-only owner-scoped gate API, iPhone UI, pure audit tests, and truthful scheduler completion reporting.

## Verified live dataset (Jhadina Supabase, October 21)
Observed via read-only SQL. Not automatically evidence that the current web deployment uses this database:
- 1 artist project, 83 song campaign rows, 22 catalog releases, 20 music public-platform references, 6 planned experiments.
- 83 song rows without populated section arrays; all rights_state=review_required; zero observed campaign results and zero validated learning.
- 6 planned experiments use `cross-platform-staging`: **not** real attributable provider campaigns.
- Zero connected Social accounts, zero Music–Social lineage records, zero enabled autopilot charters/runs, zero royalty snapshots.
- Commissioning receipts can be `complete` for schema/source certification even when Music commissioning stages are `data_required`. No synthetic certification elevates live readiness.

## Ordered execution and honest authority
| Stage | Source work completed here | Required external/live evidence before marking operationally complete |
|---|---|---|
| .01 Exact-head | Donor/merge inventory and non-destructive regression architecture | Exact-current-head PR CI and selective code review |
| .02 Catalog/sections | Read-only verified-section and approved-rights pairing; no duplicates or guessed timings | Approved source audio and actual section extraction for one song |
| .03 Rights/accounts | Distinguish discovered catalog profiles from OAuth-connected accounts | Documented master/publishing/sample clearances and authenticated provider account, with scope |
| .04 Director | Unverified state unless Music-linked independently approved asset evidence | Real rendered asset SHA, preview and owner approval; no new billable GPU here |
| .05 Social | No scheduler-side fake owner approvals; requires verified provider post ID/readback + Music lineage | Independently consumed child approval and provider readback; code donor #1299 reviewed after Social security #1430/#1436 |
| .06 Experiments | Exclude `cross-platform-staging`, low-confidence/bot-risk observations, unrelated learning | Real provider-attributed experiments, replicated qualified signal and changed next creative brief |
| .07 Fans/revenue | Requires paid/royalty evidence and real direct fan captures, not catalog metadata | Rights-cleared offer, direct-fan consent, royalty statement, reconcilable funnel evidence |
| .08 Acceptance | Phone-first status UI, fail-closed readiness, scheduler completion truth correction and tests | Independent actual iPhone owner session and approved end-to-end external-provider canary |

## Evidence vs claims
- The new GET `/api/music/juggernaut/recovery` requires the existing identity verifier and always selects the canonical owner/project. It performs no writes and returns aggregated counts and blockers rather than full user records.
- Optional privileged proof (Director asset approval, provider post readback, phone acceptance) is deliberately **unverified**, not zero or successful. An inaccessible table is **unknown**, not an empty database.
- The canonical `/music/juggernaut` page surfaces the gate results; it does **not** add a publish/spend/activate button.
- `runMusicAutopilotWorker` now reports `processed`, `completed`, `blocked`, `failed` distinctly. A receipt with unfinished stages, disabled charter, blockers or pending approval cannot count as a finished run.
- This source tranche cannot truthfully certify real assets, license authority, social account scopes, private analytics, video playback, performance lift or paid returns.

## Exact-head validation plan
1. GitHub PR exact-head Web and Music typecheck/tests, UI/route checks, lint and access controls. Inspect failing jobs independently.
2. Real owner read-only GET with correct Supabase project ref; compare stage/counts against SQL without trusting table estimates.
3. Prove project-isolation negative case, denied session 401, optional-denied proof stays unknown, zero external side effects.
4. Separate staging database migrations and role/RLS checks for later Social operator stack. No unrelated SQL production apply.
5. Owner reviews one real song/rights/media canary; explicitly approves any publishing or spending in canonical Action Core before executing.


## MUSIC-CROSS-CORE — reusable campaign pipeline (Moments first)

This PR also adds the **reusable per-song** bridge rather than another independent service. `Moments` is the selected canary, but any owner-scoped `catalog:* ` song can be chosen from the same existing 83-song projection.

1. `music-cross-core-bridge.ts` uses **canonical Music creative briefs** and applies three different SEARCH treatments: cinematic mini-story, raw performance and relatable meme. Each carries a deterministic song/variant experiment key.
2. It creates canonical **Social Core `ContentProject`** objects, preserving the artist brand, source song, evidence and draft-only authority. No connected platform account, no audience, no fake engagement.
3. `buildDirectorBriefFromSocial` produces **Director Core social production briefs** only if a real owner-owned Director project ID has been verified through the existing owner-scoped projects table. Producing a brief does not start a video render, provision a GPU or approve an asset.
4. `buildMusicCrossCoreMetaDraft` selectively uses **approved Director media receipts and the existing Meta draft builder** after documented rights, at least two validated same-song replications, verified provider-account/audience inputs and a positive bounded budget. It cannot publish an advertisement: the existing `requestPaidCampaign` / Action Core receipt remains the separately approved spending and dispatch authority.
5. **Owner-only `/api/music/juggernaut/creative-workspace`**: GET previews a selected catalog song and available owner Director projects; POST (only by an explicit button) saves the *missing* Social drafts while preserving previously edited drafts. No schema migration, direct Social publishing, paid campaign request or Director media-generation call.
6. The existing Music `content-stage` endpoint has a **cross-song attribution fix**: an unknown brief ID no longer silently falls back to a different brief, and the song is selected by that brief's `songId`, not by whichever track ranks first.
7. The iPhone Juggernaut page includes song selection, per-variant preview, owner Director-project binding and a deliberate **Save 3 private Social drafts** action, with clear links to the three canonical cores.

**Still blocked:** `Moments` is currently `rights_state=review_required` with zero recorded real sections, Social accounts = 0 and approved Music-linked media not verified. Source compilation, candidate concepts, Creator drafts and synthetic CI do not cure this. A saved draft is not a usable licensed video or published post.

**Test boundary:** The dedicated cross-core tests reject missing rights, under-replicated song learning, unrelated approval receipts, and missing verified Director binding. The CI certification runs the new tests alongside the Music/Jhadina type-check. Live phone / approval / published-provider readback remains separate operator evidence.
