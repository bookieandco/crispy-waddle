# Jhadina Personality Core v2

Status: durable persistence implemented; production port composition remains in progress

## Purpose

Jhadina's personality is a durable, evidence-backed behavioral profile. It is not a prompt, a model persona, or a collection of canned quips.

The personality layer determines how Jhadina tends to communicate, what interaction patterns it prefers, how it expresses humor, what creative/taste preferences it has, and how it develops a relationship model from repeated interaction. It never grants authority.

## Boundaries

```text
Identity Core
  └─ who Jhadina is

Values Core
  └─ what Jhadina must protect / refuse

Policy Core
  └─ what Jhadina is authorized to do

Personality Core
  ├─ temperament
  ├─ communication
  ├─ preferences
  ├─ tendencies
  ├─ humor
  ├─ opinions
  ├─ taste
  └─ relationship model

Expression Layer
  └─ voice, quips, callbacks, formatting, cultural freshness

Reasoning Model
  └─ proposes language/reasoning; does not own personality state
```

Personality can influence presentation and interaction strategy. It cannot override Identity, Values, Policy, authorization, memory approval, security, or execution controls.

## Learning pipeline

```text
Experience
  → Memory observation
  → approved / validated evidence
  → Pattern Engine
  → explicitly personality-eligible PatternObservation
  → Personality Core projection
  → versioned PersonalityState
  → durable repository
  → Context Builder
  → Reasoning Model
  → Expression Layer
  → observable response
  → outcome / feedback
  → LearningRecord
  → Pattern Engine
```

Raw memory does not directly become a personality trait. The Pattern Engine must explicitly mark a pattern as personality-eligible and assign its personality dimension.

## Evidence rules

1. Every durable trait has provenance.
2. A single interaction is not enough to establish a durable trait.
3. Repeated evidence raises confidence and stability.
4. Contradictory evidence creates a `contested` trait rather than silently replacing the prior state.
5. Retired traits remain auditable and are not silently resurrected.
6. Unapproved memory evidence cannot influence personality.
7. Malformed persisted state must fail closed.
8. Personality changes are versioned and must be reversible through governed evolution.
9. The reasoning model may propose personality changes but cannot persist them directly.
10. Personality never contains Values Core rules, capability grants, credentials, authority, or security policy.

## Durable persistence

`PersonalityStateRepository` is the persistence contract. The server-only Supabase implementation stores immutable, versioned snapshots in `public.jhadina_personality_states` and uses an atomic Postgres RPC for optimistic concurrency.

The snapshot key is `(profile_id, version)`. A save is accepted only when the persisted latest version equals the caller's expected version, and the next state version is exactly `expectedVersion + 1`. Stale writers therefore fail closed instead of overwriting newer personality state.

Until Identity Core is authoritative for the application, the adapter uses an explicit `default` profile and service-role-only access. Do not pretend `auth.uid()` provides user isolation before the real identity boundary exists.

## Durable submodels

### Temperament

Stable tendencies such as patience, assertiveness, skepticism, curiosity, and risk posture.

### Communication

How Jhadina normally explains things: directness, warmth, verbosity, disagreement directness, humor, and related presentation tendencies.

### Taste

A separate durable preference surface for novelty, experimentation, convention tolerance, and aesthetic intensity. Taste is not flattened into generic personality text.

### Relationship

Interaction-derived calibration: familiarity, preferred interaction modes, recurring callbacks, and confidence in those patterns. This is an interaction model, not a claim of emotional dependency or authority.

### Expression

The expression layer turns personality into language behavior. Quips, callbacks, profanity, pop-culture references, and stylistic choices are expression decisions informed by personality + context + current knowledge. They are not the personality source of truth.

## Independent disagreement

Jhadina should be able to disagree with the user when its established personality/opinion evidence supports a position, but disagreement is never a substitute for factual verification or policy.

```text
User claim
  ↓
Current evidence / knowledge check
  ↓
Personality opinion state (if relevant)
  ↓
Independent assessment
  ↓
Agree / disagree / uncertain
```

If evidence is equally strong or contradictory, Jhadina should surface uncertainty rather than manufacture confidence.

## Current implementation

`packages/jhadina-core-spine/src/personality-core.ts` provides the governed projection engine and repository boundary.

`apps/jhadina-web/src/lib/personality/supabase-personality-state-repository.ts` provides the server-only Supabase implementation.

`supabase/migrations/20260902060000_create_jhadina_personality_state.sql` provides the versioned snapshot table, service-role-only RLS boundary, and atomic optimistic-concurrency RPC.

The direct context fallback still uses `emptyPersonalityState()` and explicitly records that personality has not yet been assembled through the real ports. This is intentional until production MemoryPort → PatternPort → PersonalityPort composition is wired.

## Next implementation boundary

1. Implement the real `MemoryPort` over the durable Memory Core.
2. Implement the real `PatternPort` and require explicit personality eligibility metadata.
3. Compose MemoryPort → PatternPort → `createPersonalityPort()` using the durable repository.
4. Feed the resulting personality state into Context Builder instead of the empty-state fallback.
5. Add Expression Mixer and outcome-to-personality LearningRecord feedback.
6. Add behavioral drift detection and governed personality evolution.

## Do not do

- Do not add a second personality schema.
- Do not make the LLM the personality database.
- Do not copy the old `packages/personality-core` branch wholesale.
- Do not treat `value` personality traits as Values Core rules.
- Do not let a single user utterance permanently change personality.
- Do not persist inferred personality from an unapproved memory.
- Do not let quip lists substitute for a learned expression system.
- Do not let personality changes alter permissions or security.
