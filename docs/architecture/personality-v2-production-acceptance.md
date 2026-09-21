# PERSONALITY-V2.PROD.10 — Production Acceptance

Status: **subsystem acceptance gate implemented**. The Personality v2 production
lane is accepted when the dedicated Personality Core CI is green on the exact
merge head. Repository-wide deployment failures outside this subsystem remain
separate release blockers and must not be hidden by this gate.

## Canonical production loop

```text
live user request
  → Context Builder
  → Hippocampus + approved Memory
  → governed Pattern strategies
  → explicit Personality eligibility
  → versioned durable PersonalityState
  → Real Nigga Core behavioral posture
  → Behavioral Kernel
  → Expression Kernel
  → model realization
  → deterministic governed expression assets
  → persisted conversation Experience
  → explicit outcome feedback
  → causally linked Hippocampal episode
  → future pattern hypotheses
```

Outcome feedback is learning evidence only. It never grants authorization,
approves Memory, or directly mutates Personality.

## PROD.1–PROD.10 acceptance matrix

| Gate | Acceptance condition | Evidence |
| --- | --- | --- |
| PROD.1 | Every successful conversation persists the actual user request as canonical Experience; PROCEED candidates reuse that lineage. | governed intelligence vertical regressions |
| PROD.2 | Response outcome can be explicitly recorded against the returned reasoning-event id. | authenticated feedback route + recorder |
| PROD.3 | Feedback preserves actor, outcome, correlation, causation, metadata, and observation time in the existing reasoning-event store. | MemoryStorage/Supabase adapter + additive migration |
| PROD.4 | Feedback reaches Hippocampus but cannot directly become durable Personality evidence or approved Memory. | outcome-feedback vertical regression |
| PROD.5 | Outcome lineage survives a storage-adapter restart. | SupabaseMemoryStorage restart regression |
| PROD.6 | Client retries are idempotent; reuse of a feedback id with different semantics fails closed. | feedback idempotency regression |
| PROD.7 | Learned style remains below safety/policy/authorization; only accepted governed traits calibrate behavior. | FINAL certification + feedback no-mutation regression |
| PROD.8 | Feedback writes are identity-verified and durably audited as learning-only events. | production feedback route |
| PROD.9 | Cross-user targets, invalid targets, causal inversion, missing correction text, and idempotency conflicts fail closed. | adversarial feedback regressions |
| PROD.10 | Dedicated CI covers Core Spine, Intelligence Core, persisted Personality/Hippocampus, production feedback, and durable storage mapping on the exact head. | Jhadina Personality Core CI |

## Outcome semantics

Supported explicit outcomes are:

- `reinforced` — the response/approach worked;
- `corrected` — the user supplies an explicit correction;
- `rejected` — the response/approach did not work;
- `abandoned` — the approach should no longer be pursued for this interaction lineage.

These labels are observations, not authority. A correction does not rewrite
Personality. It becomes a causally linked episode; durable Personality still
requires approved immutable evidence, a governed semantic Pattern, and an
explicit eligibility rule.

## Persistence and migration

No second episodic database is introduced. PROD.2 extends
`jhadina_reasoning_events` additively with:

- `actor`
- `outcome`
- `correlation_id`
- `causation_id`
- `metadata`

Legacy rows remain valid and default to `actor = user`. Existing service-role
RLS remains authoritative.

## Replay and drift rules

1. A stable `feedbackId` identifies one semantic feedback write.
2. Exact replay returns the existing event and does not append another episode.
3. Reusing the id for another target, outcome, or note is a conflict.
4. Feedback timestamps cannot precede the response they evaluate.
5. Outcome episodes remain generic/Personality-ineligible unless independent,
   approved durable evidence later satisfies a governed semantic rule.
6. Candidate, contested, and retired traits never calibrate behavioral posture.
7. Serious/precision context still suppresses humor, profanity, callbacks,
   cultural references, and creative experimentation.

## UI boundary

Ask Jhadina returns `reasoningEventId` with each successful response. The UI
can submit explicit “Worked” / “Not quite” feedback against that exact lineage.
The richer `corrected` and `abandoned` outcomes are supported by the API for
future surfaces.

## Release rule

Do not call the whole application deployed merely because this subsystem gate
passes. Personality PROD.10 means the Personality production contract is
accepted on the exact code head. A live deployment still requires the normal
Jhadina Web/Launch/hosting gates to be green and the production alias to serve
that accepted lineage.


## PROD.10 acceptance receipt — 2026-09-20

Accepted Personality production lineage: `a20ec7b014bc94d1c449e96c8f499516e399f4a6`
(PR #488).

Dedicated **Jhadina Personality Core CI** run `35543361194` passed on that
exact merge commit. Its production gate completed all of the following
successfully:

- Core Spine type-check;
- Core Spine regressions;
- Intelligence Core type-check;
- Intelligence Core regressions;
- persisted Personality/Hippocampus/Ask Jhadina vertical regressions;
- outcome-feedback regressions;
- feedback HTTP/audit-boundary regressions;
- Supabase outcome-lineage/restart regressions.

The persisted production vertical reported **10 test files / 67 tests passed**.

Subsequent mainline changes through the receipt's base commit do not alter the
Personality PROD.10 implementation. They are therefore downstream mainline
changes rather than a replacement Personality certification lineage.

### Independent repository-wide blockers at acceptance time

These are intentionally **not** reclassified as Personality failures:

- Jhadina Web production build: Director review route imports the missing
  `@/lib/director-review-transition-repository` module.
- Repository Launch Gate: `@jhadina/tv-core` type-check reports unused
  `assertTVEpisode` in `src/providers/authorized.ts`.

Those failures remain normal application/release blockers for their owning
subsystems. They do not weaken, skip, or replace the dedicated Personality
acceptance gate above.

**PERSONALITY-V2.PROD.10: ACCEPTED.**
