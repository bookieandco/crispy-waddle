# Jhadina Personality Core Contract

Status: Core architecture contract
Version: 1.0

## Purpose

Jhadina's personality is a learned, explainable, revisable interaction profile. It is not owned by the underlying reasoning model and it cannot be silently rewritten by inference.

## Core pipeline

```text
Experience
  -> JANET candidate
  -> User approval
  -> Memory Core
  -> Pattern Engine
  -> Personality proposal
  -> Values / Policy validation
  -> Personality Core
  -> Context Builder
  -> Reasoning Model
  -> Jhadina response or action
```

## Responsibilities

### Memory Core

Stores approved facts, provenance, dates, sources, context, and user decisions. Memory does not directly define personality.

### Pattern Engine

Derives behavioral patterns from accumulated approved evidence. Patterns carry confidence and provenance and must account for contradictory evidence.

### Personality Core

Maintains Jhadina's learned interaction profile, including preferences such as voice, directness, explanation depth, decision presentation, and interaction style.

Personality traits must be:

- evidence-backed
- attributable to approved memories or validated patterns
- confidence-aware
- revisable
- resistant to single-event overfitting

### Context Builder

Builds the context packet supplied to the reasoning model from approved memory, validated patterns, current mission context, and applicable personality traits.

### Reasoning Model

The LLM is a replaceable reasoning component. It does not own Jhadina's identity, memory, values, or personality state.

### Values / Policy

Deterministic safeguards remain authoritative. Personality may influence presentation and interaction strategy but cannot override policy, safety, ownership, approval, or financial constraints.

## Trust invariants

1. Unapproved memory cannot modify personality.
2. Every persisted personality trait must have provenance.
3. Contradictory evidence creates a reviewable change rather than a silent overwrite.
4. A personality change must be reversible.
5. Personality affects how Jhadina communicates and prioritizes interactions; it does not grant authority to take prohibited actions.
6. The user remains the final authority over persistent personal learning.
7. The reasoning model receives personality as context; it does not become the source of truth for personality.

## Personality learning loop

```text
Observed interaction
  -> Candidate memory
  -> Explicit approval
  -> Pattern evidence
  -> Proposed trait
  -> Validation
  -> Persisted trait
  -> Context injection
  -> Observable Jhadina behavior
```

## Example

If approved memories repeatedly establish that the user prefers concise, action-oriented explanations, the Pattern Engine may propose a `communication.directness` trait. The Personality Core can persist that trait with confidence and provenance. Future responses may then become more concise and action-oriented.

A single request for a short answer must not permanently redefine the personality.

## Phase boundary

This contract establishes the architectural source of truth. It does not implement autonomous personality learning, hidden inference, or a new LLM behavior layer. Those require separate verified implementation work and tests.
