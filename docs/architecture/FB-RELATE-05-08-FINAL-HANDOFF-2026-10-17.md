# FB-RELATE.05–.08 → FINAL: source closure / live release hold

**Date:** 2026-10-17
**Repo/PR:** `bookieandco/crispy-waddle` #1351 (draft, unmerged)
**Primary dependency:** SWLC Supabase issue #1017; all-time archive tracked separately #1355.
**Verdict:** Source implementation complete for this sequence; live production acceptance **NOT COMMISSIONED**.

## .05 — Governed model delivery
- Existing `handleJhadinaCommand` builds `ContextPacket` through canonical Memory and supplies it to `IntelligenceRouter`.
- Actual Anthropic provider sends JSON-serialized ContextPacket to Messages API; optional Gemini provider sends the same packet and shared system prompt.
- Added explicit interpretation guidance for only the separately approved `Owner-approved Jhadina interaction preference:` Memory prefix; descriptive Facebook CONTEXT memories are not style mandates.
- Explicit preference remains subordinate to the current user task, restrictions, safety, truthfulness, policy and Jhadina's own independent judgment. No new executor, model credential, third-party service or personality mutation.
- Provider regression tests assert serialized preference and shared governance prompt for Anthropic and Gemini using fake HTTP only; no real model traffic or model-style output quality claimed.

## .06 — Interaction quality and correction tests
- Existing owner bridge verifies separate opt-in, PENDING candidate, approval, cross-topic recall, user isolation, blocked cross-owner corrections, and active-recall retirement.
- New model/context test verifies retired or corrected **timeline approvals** cannot resurface the old text through `contextPacket.knowledge`. Audit records remain retained outside active model context.
- Cross-topic guidance suppressed in high-stakes, distressed, serious and precision-critical turns; historic writing observations stay topical.
- This is not a real-person imitation system; no post text is transmitted or learned.

## .07 — Supabase audit / repair
- SWLC `kqbkaozfjubkjevdfvic` `get_project`: `ACTIVE_HEALTHY` metadata; **not** readiness proof.
- Direct read-only Postgres SQL: `FATAL 57P03`, database not accepting connections; hot standby disabled.
- Independent read-only recent `postgres_logs`: repeated database not accepting connections at 2026-10-17T23:05Z.
- Existing canonical P0 recovery issue [#1017](https://github.com/bookieandco/crispy-waddle/issues/1017) received a specific FB-RELATE audit/repair update; related #1110 and #1340 are already tracked. No duplicate project/schema, migrations, production records, credentials, billing changes, restarts, upgrades or destructive recovery were attempted.
- Once recovered, prove exact applied migrations and RPCs, anon/auth/service-role access boundaries, multiuser read/write isolation, approval transitions, correction/retirement, persistent cross-session availability, encrypted off-host backup/restore and post-restart read.

## .08 — Owner-controlled iPhone acceptance
- Source UI remains `/memory/facebook`, local-only file picker for up to 6 selected JSON/ZIP exports; displays bounded year coverage and partial sample warnings.
- Owner can separately handwrite an interaction preference, explicitly opt in to proposal, approve in Approval Center, then ask new questions in a fresh session.
- File selection and Clear Preview now reset the optional preference draft, consent and pending status to prevent stale device state.
- Real physical iPhone Safari acceptance **NOT RUN** because PR is unmerged and authenticated backend is not commissioned. On device, capture evidence for:
  1. Login to deployed owner-only build with working durable storage.
  2. Pick private one-year ZIP from Files (not GitHub), preview writing without network archive upload, test cancellation and Clear Preview.
  3. Review descriptive note and write an independent conversational preference; confirm separate opt-in.
  4. Propose -> Approval Center shows pending -> approve -> new Ask Jhadina turn with nonoverlapping words. Confirm preference shapes presentation but not facts or execution.
  5. Test humor/pushback and a precision or high-stakes request; owner preference must not weaken those boundaries.
  6. Correct preference -> fresh session sees new but not old note; Forget -> fresh session sees neither old nor retired timeline text.
  7. Use second authenticated owner to verify no cross-owner data exposure; restart session and verify durable read.
  8. Confirm app revision, external encryption/backups, no raw archive network request or logs.
- The all-time ZIP is **not required** for this one-year pilot. When supplied, execute issue #1355 schema, size, cross-year and dedup audit separately.

## Release hold / no unverified claims
- Current exact-head CI results must be independently recorded after the final commit. Passing prior commits is not enough.
- Source unit/provider tests are not proof that an actual model reply obeys the preference, iPhone Safari supports its ZIP compression, or durable Memory works after restart.
- No real Facebook upload to server, automatic training, inferred permanent traits, production memory write, unauthorized deployment or promotion to `main`.

**FINAL = source closeout with external commissioning blockers, NOT a live-ready or merged state.**
