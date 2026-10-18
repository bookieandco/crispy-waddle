# TELEGRAM-ALPHA.04–.06: prospective public paper research

Status: source-only, no deployment, no Telegram-message ingestion or AI/ML training.

## Sequence

- .04: Begin one case from an explicitly owner-selected public Solana mint dossier. Seal actual market availability, mint, selected original pool, provider-reported price and liquidity in a locally hash-linked study. Native WSOL mints and incomplete/stale dossiers are rejected. Local hash chains are not independently immutable evidence.
- .05: Add later public-only observations in strict time order. Before 24h observations remain unscored. Only same original pool from 24–30h can get price-only move; after 30h or pool change are censored. Do not claim executable profit, real fills, verified sellability, costs, fees, slippage, or alpha edge. Missing snapshots are rejected rather than forged.
- .06: A local-file-only research view at /shark/alpha, linked from the canonical Money command center, shows public observed points, graph and conservative outcome labels. No file upload, backend writes, or private Telegram data.

## Manual local usage (Python 3.11+)

Use a public Solana mint you are authorized to research; these commands are local, not automated or scheduled:

```sh
python3 ops/meme/public_mint_dossier.py --mint YOUR_PUBLIC_MINT --read-public > alpha_first.json
python3 ops/meme/public_alpha_study.py begin --dossier alpha_first.json --out alpha_study_01.json
# Prospectively, 24–30 hours after the first market availability:
python3 ops/meme/public_mint_dossier.py --mint THE_SAME_PUBLIC_MINT --read-public > alpha_follow.json
python3 ops/meme/public_alpha_study.py follow --study alpha_study_01.json --dossier alpha_follow.json --out alpha_study_02.json
python3 ops/meme/public_alpha_study.py summary --study alpha_study_02.json
```

Open alpha_study_02.json in Jhadina → Money → SHARK Alpha. The UI cannot authenticate provider provenance or prove chronology and must not be used to authorize trades.

## Tests

```sh
python3 -m unittest discover -s ops/meme -p 'test_public_alpha_study.py' -v
pnpm --filter @jhadina/jhadina-web exec vitest run src/lib/shark/public-alpha-study-view.test.ts
```

CI tests use synthetic fixed fixtures. The only real Telegram manual-dispatch workflow still belongs to the protected trusted main and is separate from these modules.

## Release hold

PRs #1365 → #1366 → #1367 are unmerged draft dependencies, followed by this stacked PR. No verified real provider readback, live iPhone acceptance, current production deployment, or independent timestamps. Personal Telegram reader issue #1238, Telegram API AI/ML data restrictions, and privacy review remain separate blockers. Neither automated collection nor wallet/trading authority is granted.
