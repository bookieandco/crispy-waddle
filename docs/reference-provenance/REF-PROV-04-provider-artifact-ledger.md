# REF-PROV-04 Provider + Artifact Ledger

## Provider contracts

| Provider | Version strategy | Pinned contract |
| --- | --- | --- |
| Plaid | header | Plaid-Version 2020-09-14 |
| Stripe | header | Stripe-Version 2026-08-26.dahlia |
| Anthropic | header | anthropic-version 2023-06-01 |
| Shodan | contract digest | source-conformed unversioned snapshot |
| InternetDB | contract digest | source-conformed unversioned snapshot |
| DexScreener | path | token-pairs v1 |
| CoinGecko Pro | path | API v3 |
| Helius | protocol | JSON-RPC 2.0 / getTransfersByAddress |
| SAM.gov | path | Opportunities v2 |
| ComfyUI | upstream revision | c8ed2c8ce957475459731135c4ca31c6856a4542 |
| Reticulum | upstream revision | 99de23c040d507e3fefca19e87b182302902725d |
| Supabase | package version | @supabase/supabase-js 2.116.0 |

## Artifact admission debt

No production artifact digest is invented.

The following are explicitly unresolved:

- SAM2 checkpoint
- ComfyUI model bundle
- VoiceFixer weights
- NeuralNote model
- ACE-Step model

Each must eventually be replaced by a concrete artifact locator and SHA-256
before production admission.

## Rule

Provider contract identity proves compatibility expectations.

Artifact identity proves exact bytes.

Neither proves factual correctness or grants authority.
