# Jhadina Core Spine

## Purpose

The Core Spine is the control-plane contract that makes Jhadina one operating system rather than a collection of domain applications.

The spine does not own domain business logic or an LLM. It owns the order in which evidence, memory, patterns, personality, context, decisions, policy, capabilities, actions, and audit records interact.

## Canonical loop

```text
Experience
   ↓
Memory observation
   ↓
Pattern detection
   ↓
Personality state
   ↓
Context packet
   ↓
Decision proposal
   ↓
Policy evaluation
   ↓
Capability / action preparation
   ↓
Action execution
   ↓
Audit
   ↓
Memory / pattern / evolution feedback
```

## Personality rule

Jhadina's personality is evidence-backed state, not a static system prompt and not a mechanism for agreeing with the user.

Durable personality traits must have:

- provenance;
- confidence;
- stability;
- contradictory evidence tracking;
- lifecycle state;
- a path for revision or retirement.

A reasoning provider may propose an interpretation, but it does not get to silently rewrite personality.

## Independence rule

The decision layer must preserve the ability to disagree. A decision proposal contains a recommendation, rationale, uncertainty, evidence, and alternatives. The personality layer supplies context; it does not force agreement.

## Governance rule

No action reaches an executor without policy evaluation. Denied decisions stop at the policy boundary and are audited. Authorized actions are audited before/after execution through the spine's audit port.

## Domain rule

Domain OSes implement ports/adapters. They do not become alternate control planes. OverageOS, MusicOS, TVOS, CampaignOS, Money Core, Director, and future systems plug into the spine through typed capabilities and events.

## Evolution rule

The spine exposes the state needed to support the longer evolution loop:

```text
experience → pattern → personality candidate → review/decision → committed change → future context
```

This package establishes the contracts and orchestration boundary. Persistence, LLM providers, domain adapters, and user-facing approval screens remain replaceable implementations behind the ports.
