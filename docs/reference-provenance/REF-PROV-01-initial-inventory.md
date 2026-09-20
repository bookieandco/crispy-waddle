# REF-PROV-01 Initial Inventory

This file is intentionally small and auditable. It is not a claim that every
reference ever discussed with Jhadina has already been recovered.

## Repository-traceable at this phase

| Reference | Current proof | Mapping status |
| --- | --- | --- |
| Godot Engine | `apps/pupsonstuff/.pupsonstuff-engine-plan.md` | PLANNED / idea-only |
| Turbulenz Engine | `apps/pupsonstuff/.pupsonstuff-engine-plan.md` | PLANNED / idea-only |
| DexScreener API | SHARK DexScreener ingest + pool discovery source | IMPLEMENTED / provider interface |

## Captured handoff-only debt

These references are deliberately **not** marked implemented until repository or
external verification proves the relationship:

- MDP-Adaptive-GA
- SelfAware
- Coach-RL
- alpha-beta-CROWN
- pump-public-docs
- Meteora-Rug-Bot
- wallet-cluster-detector
- GPT Researcher
- deep-research
- policy-gate

## Why Meteora-Rug-Bot is handoff-only even though Meteora code exists

Current main clearly contains Meteora DLMM intelligence code.

That proves a relationship to the Meteora protocol/domain.

It does **not** prove that the implementation was derived from
`keidev-sol/Meteora-Rug-Bot`.

REF-PROV-01 therefore refuses to collapse “same subject” into “source
provenance.”

The same rule applies to every future audit.
