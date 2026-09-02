# Jhadina Personality Core v2

Status: implementation in progress

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

`packages/jhadina-core-spine/src/personality-core.ts` provides the first governed projection engine and repository boundary.

`PersonalityStateRepository` is intentionally an interface. The durable Supabase adapter belongs outside the pure core and must be server-only.

The direct context fallback uses `emptyPersonalityState()` and explicitly records that personality has not yet been assembled through the real ports. This is intentional until the production MemoryPort → PatternPort → PersonalityPort composition is wired.

## Do not do

- Do not add a second personality schema.
- Do not make the LLM the personality database.
- Do not copy the old `packages/personality-core` branch wholesale.
- Do not treat `value` personality traits as Values Core rules.
- Do not let a single user utterance permanently change personality.
- Do not persist inferred personality from an unapproved memory.
- Do not let quip lists substitute for a learned expression system.
- Do not let personality changes alter permissions or security.
