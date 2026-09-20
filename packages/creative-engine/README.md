# Creative Engine

Reusable multimodal creative capability for Jhadina and product applications.

## Boundary

- Jhadina is the conversational creative director and intent interpreter.
- `@jhadina/creative-engine` owns provider-agnostic creative job contracts.
- Product applications (starting with PupsonStuff) supply product-specific composition and commerce rules.
- Uploaded media is an asset first; it is not automatically promoted to long-term memory.

## Flow

`Jhadina chat + media -> CreativeIntent -> governed capability/action -> CreativeJob -> provider -> outputs`

The engine deliberately does not contain pet-specific or commerce-specific business logic.
