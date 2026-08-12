# Jhadina HCI UX Contract v1

This contract turns the HCI principles distilled in `docs/UX_HCI_HANDBOOK_NOTES.md` into product-level UX rules.

## 1. Truth: fluency is not evidence

**Source principle:** the ELIZA effect / users over-attribute intelligence to fluent systems.

Jhadina must distinguish what is known from what is generated, inferred, proposed, planned, executing, completed, failed, or unknown.

### Required states

- `KNOWN`
- `INFERRED`
- `SUGGESTED`
- `PLANNED`
- `AWAITING_APPROVAL`
- `EXECUTING`
- `COMPLETED`
- `FAILED`
- `UNKNOWN`

A completed-action statement such as "the order was placed" is only valid after the action executor reports verified completion.

A conversational response must never silently become durable memory. Candidate memories remain inert until the existing approval workflow commits them.

## 2. Authority: perception and planning do not equal permission

**Source principle:** function allocation is a deliberate design choice.

Jhadina may interpret intent, reason, recommend, and construct plans. Deterministic policy and authorization code decide whether an action may execute.

```text
Perception -> Intent -> Plan -> Policy -> Authorization -> Execution -> Verification
```

No model output may bypass the Enforcement Boundary.

Examples:

- "Buy Mom flowers" can produce a purchase plan, but spending authorization remains outside the LLM.
- "Finish this scene" can produce a Director plan, but execution remains capability/policy controlled.
- "Publish this" can prepare social content, but publishing remains an explicitly governed action.

## 3. Feedback: every consequential action explains its state

**Source principle:** usefulness and usability must both be achieved and tested empirically.

For meaningful actions, the UI should make it easy to answer:

1. What did Jhadina understand?
2. What is she proposing?
3. What will happen if I approve it?
4. What has actually happened?
5. Can I cancel, undo, dismiss, or correct it?

Where the underlying operation supports recovery, recovery must be cheap and discoverable.

UX quality should be evaluated using real task outcomes, including completion, correction, abandonment, unnecessary clarification, reversal, and time-to-completion.

## 4. Consistency: controls retain their meaning across Jhadina

**Source principle:** metaphors and conceptual models shape user expectations.

Core vocabulary is a cross-surface contract:

| Control | Meaning |
| --- | --- |
| Approve | Authorize the proposed commitment/action at the applicable policy gate |
| Cancel | Stop the pending operation before commitment when supported |
| Undo | Reverse a completed reversible operation |
| Dismiss | Remove a suggestion from the current decision surface without implying execution |
| Save | Persist the explicitly selected artifact/state |
| Remember | Submit information to the durable-memory approval workflow |
| Forget | Remove eligible durable memory through the governed memory workflow |
| Execute | Begin the already-authorized operation |

These meanings must remain stable in Director, Growth, Opportunity, Money, Music, Cooking, Social, Shopping, Memory, and future Worlds.

## 5. Universal Jhadina interaction

The Jhadina button is a global interface to the same command architecture, not a Director-only control.

Voice, text, touch, gesture, gaze, and other perception inputs eventually converge on the same intent/context/action pipeline.

```text
Human input
    -> Perception
    -> Context
    -> Intent
    -> Plan
    -> Enforcement Boundary
    -> Action
    -> Verification
    -> Audit / Feedback
```

Perception must never directly execute an action.

## 6. Context is first-class

Jhadina should maintain a bounded current mission context containing only information relevant to the current interaction:

- person/user
- location and device context when available and permitted
- active application or World
- active project/task
- relevant approved memories
- available capabilities
- pending actions
- relevant attention signals

Context resolves references such as "this scene," "that clip," or "how much longer?" without changing the meaning of the underlying controls.

## 7. Humility and recovery

When confidence is insufficient, Jhadina should expose uncertainty and ask the smallest useful clarification rather than inventing certainty.

The user must retain a clear path to interrupt, correct, or reject an action whenever technically possible.

## 8. Auditability

Consequential actions and durable knowledge changes must remain inspectable through the existing audit model. The UI should expose enough information for the user to reconcile their mental model with system reality.

## 9. HCI source boundary

The HCI handbook note is a paraphrased internal digest, not a reproduction of the source. This contract is an engineering interpretation of that digest for Jhadina UX and should not be presented as a verbatim statement of the source authors.
