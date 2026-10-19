# FB-RELATE.MAIN-RECONCILE.01–.03 — CURRENT-MAIN SOURCE HANDOFF
Date: 2026-10-18
Status: DRAFT / SOURCE-ONLY / PRIVATE REVIEW / MEMORY ACTIVATION HOLD

## Immutable reconciliation inputs
- Source: draft PR #1351, commit `7ad747774faa584bb63acf022f52afc35f57b1f4`.
- Reconciled base: current `main` at `ad5830382d6c209dca63da41c93f2575d6ed2242`.
- Branch: `feat/fb-relate-main-reconcile-20261018`.
- Source transfer commit: `cdb596d18cfa0d2f8368428c35f930dee10ab3ab`.
- Stale-draft guard commit: `ff1dff5c72ddb6e10ab7870d710f891b76fcfa54`.

## Selective transfer
Ported 26 Facebook-specific source, test and historical handoff files. Shared files
`memory/page.tsx`, `context-builder.ts`, Anthropic/Gemini provider guidance and tests
were checked against the original merge base: current main still held those identical
pre-Facebook versions. The port is not a whole-branch merge and preserves the 198
other main commits absent from the old PR snapshot.

Left out intentionally:
- `.github/workflows/jhadina-memory-cloudflare-d1-ci.yml`
- `deploy/jhadina-memory-cloudflare/**`
- `apps/jhadina-web/src/lib/storage/createMemoryStorage.ts` and its test
- `apps/jhadina-web/src/lib/supabase/middleware.ts` and its test

Therefore D1 is NOT configured/commissioned, no storage provider is changed, and
no route-level authentication exception from the old branch is applied. In the
new branch, `/memory/facebook` follows current main's Supabase session gate,
and all previews must additionally retain project-level Vercel SSO protection.
The older owner-protected preview from PR #1351 remains the device-test reference;
it is not proof that this new branch has been tested on an iPhone.

## Review-state repair (source-only)
Editing any writing cue resets its decision to undecided. Editing or changing
a decision also discards any previously staged owner note, and revokes its
reviewed/proposed UI flags so a rejected cue cannot remain in a stale note.
The local reset helper returns empty items and draft, false consent and false
proposal state. Pure-state Vitest regression covers reject/edit and reset.
Physical Safari interaction acceptance remains required.

## Existing safety boundaries retained
- Client-only bounded JSON / ZIP selection and compressed slices, not ZIP upload.
- Messages, private security info, media and friend data excluded.
- Observed denominators are NOT lifetime account totals. 2,500 sample cap.
- Cue cards are observations, never inferred stable traits.
- Copy receipts contain numeric counts and no Facebook text.
- Canonical API requires signed-in owner, same-origin, explicit reviewed note,
  and only proposes PENDING Memory records. No API writes were triggered here.
- Pending approval, reject/correct/forget, next-session recall, cross-owner
  isolation and durable storage require independent operator/runtime evidence.

## Acceptance before merge or any runtime activation
1. Verify GitHub Actions at EXACT reconciled branch head; rerun type-check,
   lint, route and parser tests, state-transition regressions, context/provider
   serialization, production build, and security/conformance checks.
2. Confirm private deployment is READY for the same exact commit and verify
   Vercel project-level protection. Do not remove or bypass app authentication.
3. Owner validates new coverage-v2 numeric receipt and local keep/reject/edit
   + clear/cancel interactions on their actual iPhone ZIP (device only).
4. Obtain explicit owner approval before submitting any *particular*
   owner-authored Memory note or commissioning durable storage.
5. Validate authenticated pending/approval, owner isolation, restore and
   forget/correct semantics in a separately approved runtime test.
6. Keep both the old PR and this reconciliation PR as DRAFT and unmerged
   until security, CI and operator evidence are recorded.

Do not publish, connect personal Facebook credentials, scrape a profile,
post, spend, submit a Memory proposal, deploy production, commission D1,
or change preview visibility as part of this branch.
