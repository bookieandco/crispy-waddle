# @jhadina/entertainment-core

JEI (Jhadina Entertainment Intelligence) is the governed creative-learning core for entertainment analysis and review.

## Current vertical slice

`observation -> user feedback 👍/👎 -> taste hypothesis -> explicit approval -> creative context`

The core is intentionally provider-agnostic. Media ingestion, multimodal perception, LLM interpretation, and external APIs will be adapters layered on top of this package.

## Governance

- Observations retain evidence and confidence.
- User feedback is evidence; it does not silently rewrite approved memory.
- Taste hypotheses remain `candidate` until explicitly approved.
- Creative context exposes approved preferences plus relevant observations.
- No external side effects are performed by this core.
