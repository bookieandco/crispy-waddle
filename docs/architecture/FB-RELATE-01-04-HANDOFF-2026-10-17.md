# FB-RELATE.01–.04 — Work independently of all-time Facebook history

State: DRAFT PR #1351. Source implementation committed, **not production commissioned**.

## Why this sequence matters
An observed historical writing cue does not necessarily describe what the owner wants in a live conversation. Descriptive Facebook writing notes stay topical. Only a separate, explicitly owner-entered *interaction preference* can be considered across everyday conversation topics.

## Changes
1. **FB-RELATE.01 / contract:** a distinct, bounded, recognizable "Owner-approved Jhadina interaction preference" memory note. No post content automatically becomes this instruction; it is not PersonalityState.
2. **FB-RELATE.02 / proposal:** same-origin authenticated proposal endpoint adds a specific interaction-preference kind, requires two explicit confirmations (reviewed and interactionOptIn), and creates a PENDING canonical PREFERENCE candidate. Prior observation proposals remain CONTEXT. No direct active-memory or personality mutation.
3. **FB-RELATE.03 / context:** ContextBuilder recognizes only APPROVED PREFERENCE memories bearing the exact marker. The most recently approved one may be surfaced across **ordinary** conversational topics, within existing size and count limits. It is omitted for serious, distressed and high-stakes turns. Other Facebook observations still require topical relevance. Cross-owner reads and forgotten memories must not be surfaced.
4. **FB-RELATE.04 / UX/tests:** optional, owner-authored textarea and affirmative opt-in within /memory/facebook; clear pending/Approval Center state. Route and Context regressions cover opt-in, safe bounds, pending-only admission, cross-owner isolation, correction/forget and high-stakes suppression.

## Intentional limitations
- No private Facebook ZIP or excerpts go to the server, GitHub, tests, CI or Vercel.
- The owner must write their interaction preference explicitly; statistical writing observations alone never activate it.
- This is a Memory evidence-to-context bridge, not independent Personality Core rewriting or real learned humor.
- Do not assume every upstream model adapter faithfully uses ContextPacket evidence until Ask Jhadina prompt/render acceptance is verified.
- Earlier separately approved interaction-preference memories remain governed records. Corrections must use canonical Correct/Forget rather than ad hoc cleanup.
- If durable Memory storage is unavailable, the proposal must fail closed.
- All-time archive is independently tracked in issue #1355, and is *not* a dependency for source integration.

## Outstanding acceptance
- Exact-head CI including type-check, web build, UX/Personality/Live Context/Interaction Quality.
- Supabase SWLC 57P03 recovery, deployed schema/grants, two-account RLS, encrypted off-host backup/restore.
- A private owner-controlled iPhone flow: local one-year file preview; optional handwritten style preference; proposal -> Approval Center -> new Ask Jhadina turn using approved preference -> correction/forget -> fresh turn no recall.
- Evaluate what actually appears in generated responses, without claiming the model has been retrained.
- All-time JSON format, historic duplication and year coverage when the owner supplies the optional export.

## Release decision
Keep PR #1351 draft/unmerged, no production commissioning. Do not require all-time export to finish coding or to run the one-year pilot.
