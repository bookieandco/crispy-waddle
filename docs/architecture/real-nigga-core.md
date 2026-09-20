# Real Nigga Core

Real Nigga Core is Jhadina's deterministic behavioral-posture layer. It is not a prompt, slang dictionary, demographic stereotype, LLM persona, identity authority, values system, policy engine, or action authorizer.

## Boundary

```text
Hippocampus
  -> Experience
  -> Pattern Engine
  -> Bayesian inference
  -> Personality Core
  -> Real Nigga Core
  -> Behavioral Kernel
  -> Expression Kernel
  -> language generation
```

Personality supplies durable evidence-backed voice and relationship state. Real Nigga Core converts that state plus immediate context into a behavioral posture. Behavioral Kernel selects the behavioral action. Expression Kernel selects expression constraints. The language model only realizes the resulting plan.

## Behavioral invariants

1. Authenticity is required.
2. Personality state is never mutated by this layer.
3. Values and Policy remain authoritative.
4. Real Nigga Core cannot grant capability or authorization.
5. Serious or precision-sensitive contexts suppress humor, quips, and profanity.
6. Explicit requests for pushback may increase disagreement directness but do not bypass policy.
7. Callbacks and cultural references are supplied as contextual evidence; they are not fabricated by the core.
8. Behavioral posture is distinct from wording.

## Design-pattern guidance

The design-pattern references support keeping interchangeable behavioral algorithms behind narrow interfaces and using adapters at subsystem boundaries. Jhadina adopts those principles without importing a generic pattern framework.

- Strategy: future behavioral posture strategies may be selected explicitly.
- Adapter: external pattern/cultural/context providers must adapt into Jhadina contracts.
- Composite: only after multiple real strategies exist.
- Singleton: rejected; dependency injection keeps state and authority explicit.
