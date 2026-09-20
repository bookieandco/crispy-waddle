# PERSONALITY-V2.FINAL — Production Certification

Status: **certification gate implemented**. Merge is permitted only after the Personality Core CI passes on the final reconciled head. Runtime outcome/restart/adversarial acceptance is extended by `personality-v2-production-acceptance.md` (PROD.1–PROD.10).

## Canonical vertical

Experience → Hippocampus → durable Memory/Evidence → Pattern strategies → Bayesian belief update → explicit Personality eligibility → versioned PersonalityState → Real Nigga Core behavioral posture → Behavioral Kernel → Expression Kernel → model realization → outcome → Hippocampus.

No stage after Personality eligibility may manufacture evidence for a trait retroactively.

## Authority boundaries

- The LLM is a semantic realization component, never a Personality, Values, Policy, authorization, or execution authority.
- Pattern confidence does not grant Personality eligibility.
- Generic recurrence and generic episodic recurrence remain ineligible.
- Semantic families are deny-by-default and must have an explicit eligibility rule.
- Personality evidence must be durable, valid, independent, and immutable when the rule requires it.
- Live request IDs are never durable Personality evidence.
- Replaying the same evidence is idempotent.
- Relationship familiarity, workflow continuity, callbacks, taste, and cultural fluency never grant execution permission.
- Serious/precision context remains authoritative over humor, profanity, casual tone, callbacks, cultural references, and creative latitude.

## Certified semantic families

| Family | Durable trait | Behavioral effect |
| --- | --- | --- |
| Directness | prefers direct communication | directness |
| Concision | prefers concise communication | verbosity |
| Warmth | prefers warm communication | warmth |
| Formality | prefers formal communication | formality/tone |
| Humor | prefers humorous communication | humor |
| Profanity | allows conversational profanity | bounded profanity calibration |
| Pushback | prefers active pushback | disagreement directness |
| Technical depth | prefers technical depth | reasoning depth |
| Continuous workflow | prefers continuous workflow | presentation pacing only |
| Step-by-step | prefers step-by-step explanations | explanation structure |
| Evidence-first | prefers evidence-first explanations | explanation structure |
| Multiple options | prefers multiple options | decision presentation |
| Experimentation | prefers experimental creativity | creative latitude |
| Familiar tone | prefers familiar tone | bounded warmth/familiarity style |

## Deterministic conflict rules

1. Safety, policy, authorization, and serious/precision context are outside Personality and remain superior.
2. Serious/precision context suppresses humor, profanity, callbacks, cultural references, and creative experimentation.
3. Formal tone wins when formal and warm preferences coexist; warmth remains a posture input.
4. Concision and reasoning depth are orthogonal: brief + technical is valid.
5. Evidence-first wins over step-by-step if both traits are accepted.
6. Continuous workflow is presentation pacing only; it cannot skip approvals, create tool authority, or authorize autonomous action.
7. Candidate, contested, and retired traits do not calibrate RNC behavior.

## Lifecycle

Eligible observations enter the existing Bayesian Personality projection. Traits move through candidate, accepted, contested, and retired states under the core policy. Independent contradictions are retained. Three contradictions retire a trait under the current policy. Replays with no new evidence do not increment Personality version or confidence.

## Observability

The Personality behavior runtime emits an eligibility decision receipt for every Pattern observation. Receipts identify whether a Pattern was eligible, the governing rule, governed dimension, and denial reason.

## Migration and scale

No PersonalityState schema migration is required for these semantic families. They are stored as ordinary governed traits and projected into transient behavioral posture. Existing voice, taste, and relationship records remain readable. New ExpressionDirective fields are optional, so older consumers remain valid.

The production Hippocampus adapter already bounds relevant durable memories and final Pattern hypotheses. This semantic strategy has a fixed, finite detector set, so its work is bounded by the retrieved memory window rather than total lifetime memory.

## Acceptance tests

`personality-v2-final-certification.test.ts` is the canonical final gate. It verifies:

- every certified semantic family has exactly one explicit immutable-evidence rule;
- all families can traverse the governed Pattern → Personality → RNC → Behavior → Expression vertical;
- all resulting traits are accepted only after the required durable evidence;
- conflict precedence is deterministic;
- generic recurrence cannot bypass eligibility even at confidence 1;
- serious/precision context overrides learned presentation style;
- replaying identical durable evidence is idempotent.

Existing regression suites additionally cover persistence rollback, restart/reload, Hippocampal provenance, cross-source deduplication, callback provenance, cultural freshness, contradiction lifecycle, and model-output authority boundaries.
