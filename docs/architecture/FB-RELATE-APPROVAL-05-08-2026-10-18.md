# FB-RELATE.APPROVAL.05–.08 — Owner-governed Facebook writing review

Status: draft PR #1351, source-only acceptance pending. No archive upload, new durable writes, import approval, production cutover or public deployment.

## .05 Candidate generation
- Local client derives a short fixed-language set of possible *writing cues* from bounded sampled Facebook posts and comments: question-led phrasing, laugh markers, emphatic punctuation, emoji, brief and long-form entries.
- Default decision for every candidate is **undecided**. No automatic memory, personality-state updates, model fine-tuning or identity imitation. Sample texts and archive filenames never populate generated candidate notes.

## .06 Explicit owner review and correction
- Each cue has editable text plus **Keep in local draft / Reject cue / Undecided**. An edit resets its decision, requiring another explicit selection.
- Only selected, valid notes can be composed into the existing editable owner note using the **Use selected cues in editable note (local only)** button.
- The note requires separate *reviewed* consent and the existing authenticated owner-only pending Memory API; the canonical Approval Center remains a distinct final approval gate. It does not auto-submit.
- Conversation preferences are separately authored and opt-in; merely discovering writing cues does not change how Jhadina talks.

## .07 Safe owner audit receipt
- `FB-RELATE-LOCAL-REVIEW-v1` contains only counts and fixed decision labels, with `memoryCandidatesCreated=0`, `memoryApproved=false`, `rawFacebookWritingSent=false`.
- Receipt contains no owner writing text, note contents, excerpt indices, file or Facebook account identifiers, exact timestamps or social graph.

## .08 Regression and live blockers
- Synthetic tests verify empty/undecided default, rejected cues never entering composed notes, valid owner-edit gating, fixed category receipt and privacy exclusion.
- Existing `/api/personality/facebook/propose` uses verified owner identity, same-origin, bounded reviewed summary, and canonical pending Memory candidate path; this implementation does not call it or create records. Private protected preview login may not constitute an authenticated Jhadina Memory session.
- Further live acceptance requires owner review on Safari, correct/forget behavior after canonical approval, cross-owner isolation, durable storage/restore and next-session retrieval; no source-only test establishes those outcomes.
- Owner's real Facebook ZIP preview earlier succeeded, 3 eligible JSON files, 2,500 sampled posts/comments across 2010–2026. Later census `FB-IMPORT-LOCAL-COUNTS-v2` requires real iPhone verification.

## Strict limits
- Keep PR draft. No source writes to production, database schema activation, external publishing, advertising spending, new OAuth scopes or private FB token capture.
- Raw Facebook archive stays entirely in the owner browser.
- Any next step that persists owner-reviewed text must require owner action and a functioning approval service; no automatic background mutation or activation.

Tracking: [PR #1351](https://github.com/bookieandco/crispy-waddle/pull/1351), [#1355](https://github.com/bookieandco/crispy-waddle/issues/1355), [#1360](https://github.com/bookieandco/crispy-waddle/issues/1360).
