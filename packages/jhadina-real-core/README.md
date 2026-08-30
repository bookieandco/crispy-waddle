# @jhadina/real-core

Real Core is Jhadina's durable behavioral state layer.

It is intentionally **not** a prompt and **not** an LLM. It owns continuity that should survive model/provider replacement:

- identity and continuity key
- attention and priority
- preferences and opinions with evidence
- commitments and open loops
- relationship signals
- recent experiences and learned patterns
- uncertainty and confidence
- communication tone controls

## Boundary

```text
experience
   -> Real Core
      -> state / stance / events
         -> Context + Reasoning
            -> AuthoritativeActionProposal
               -> Policy Gate
                  -> Execution
```

Real Core may form a stance, but it never executes an external action and never bypasses policy.

## Design rule

A behavior becomes durable because it is represented as state with provenance, not because an LLM was instructed to repeat it in a system prompt.
