# REF-PROV-01 Initial Inventory

This file is intentionally small and auditable. It is not a claim that every
reference ever discussed with Jhadina has already been recovered.

## Repository-traceable at this phase

| Reference | Current proof | Mapping status |
| --- | --- | --- |
| Godot Engine | `apps/pupsonstuff/.pupsonstuff-engine-plan.md` | PLANNED / idea-only |
| Turbulenz Engine | `apps/pupsonstuff/.pupsonstuff-engine-plan.md` | PLANNED / idea-only |
| DexScreener API | SHARK DexScreener ingest + pool discovery source | IMPLEMENTED / provider interface |
| Roboflow `MOD5GEN20/stocks-2ulc2` | Verified Universe dataset page; 6,572 object-detection images, CC BY 4.0, six structural chart labels | CAPTURED / stock vision research reference |
| Roboflow `glitch-gyhbu/shitty-stocks-patterns` | Verified Universe dataset/model page; 2,000 images, CC BY 4.0, five candlestick labels, public model `shitty-stocks-patterns/6` | CAPTURED / stock vision research reference |
| Roboflow `forex-sells/forex-buys` | Public metadata: classification dataset, 126 images, opaque/numeric labels | CAPTURED / FX vision research reference; semantics + license unverified |
| Roboflow `forex-sells/forex-sells` | Public metadata: classification dataset, 199 images, opaque/numeric labels | CAPTURED / FX vision research reference; semantics + license unverified |
| `m1/go-finnhub` | Archived MIT Go client; Forex exchange/symbol/candle GET surfaces | ADAPTED / read-only provider-boundary reference |
| `Opselon/ForexTradingBot` | MIT Clean Architecture/DDD signal + queue/resilience reference | CAPTURED / architecture reference; not an execution provider |

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
