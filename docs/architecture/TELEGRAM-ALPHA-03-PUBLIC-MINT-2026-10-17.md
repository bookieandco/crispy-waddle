# TELEGRAM-ALPHA.03 — independent public-market research (code-only)

## Boundary

The Telegram owner bot has proven message receipt and private report delivery.
That is **not** evidence of live market alpha. This milestone deliberately does
**not** connect personal Telegram history, forwarded messages, derived Telegram
content, channel identities, or AI/ML training to the market pipeline.

The new standalone `ops/meme/public_mint_dossier.py` takes an **explicitly
selected public Solana mint** and reuses:

- `ops/meme/solana_risk_probe.py`: fixed public mainnet RPC endpoint and
  structural mint-owner/authority parsing.
- `ops/meme/token_authority_forensics.py`: mint/freeze/Token-2022 extension
  review, retaining unknown/transfer-control findings and no-safety-verdict.
- `ops/meme/experiment_7day.py`: existing public DexScreener token-pair
  endpoint, correct base-mint/pair selection, and liquidity floor.

No new service, Supabase table, worker, scheduler, credential, wallet,
transaction, Telegram API call, chat content transfer, or paid data provider.

## Trusted operator command (opt-in, not automatically dispatched)

On a trusted local machine with Python 3.11+:

```sh
python3 ops/meme/public_mint_dossier.py --mint '<public-Solana-mint>' --read-public
```

No `--read-public` means exit code 2, no network call.
The command performs at most the existing bounded RPC fallback for one
`getAccountInfo` and one DexScreener public-token-pairs GET, then prints a
single **research-only** JSON dossier to the local terminal. Do not give it a
private key, Telegram conversation, or bot token. Do not post its output to
public CI or interpret local output as a verified independently witnessed
receipt; provider response origin is **unattested**.

The code does not call `getTokenLargestAccounts` or import Telegram source
data. Holder independence remains unresolved, even when parsed mint/market
fields exist. Pool program identity, LP custody, actual sellability, execution
quotes, migration and rug causality remain unresolved.

## Classification / temporal integrity

- Exact reference WSOL/native Token-2022 mints remain
  `KNOWN_REFERENCE_ASSET` and **not launch leads**.
- All other syntactically valid Solana addresses remain
  `PUBLIC_MINT_RESEARCH_ONLY`, never `new launch verified`.
- A provider-returned pair must have the expected **base mint** and a Solana
  chain ID. Highest *reported* liquidity is selected using existing code.
  A pair-created timestamp is only a provider claim and **not** evidence
  of when the research system first observed an opportunity.
- Separate RPC and market read windows must be ordered and no later than
  the information cutoff; either read over 15 minutes stale quarantines.
- Missing, unparseable, wrong-chain or invalid data quarantine without
  fabricated prices, price histories, migration proofs or entry/exit fills.
- `mintLaunchVerified`, `migrationVerified`, `sellabilityVerified`,
  `executionQuoteVerified`, `predictionOrBacktestAuthorized`,
  `canTrade`, `canSign`, `canBroadcast`, `canAuthorizeLive` are all false.
- The local dossier digest is a **tamper-evident local checksum**, not a
  provider signature, independent timestamp attestation or public audit trail.

## Verification and release gate

```sh
python3 -m unittest discover -s ops/meme -p 'test_public_mint_dossier.py' -v
```

The Telegram SHARK source-only GitHub workflow runs these tests **without**
network access, secrets, actual mint snapshots, Telegram content, or a live
Telegram dispatch. The separate personal-account listener still belongs to
draft PR #1230 and audit issue #1238. Telegram API data-use terms remain an
independent constraint; this public-market-only code does not establish
permission to train models on Telegram data.

To advance `TELEGRAM-ALPHA.04`, require separately permitted and authenticated
public-market snapshot provenance plus prospective observation receipts, a
real same-pool later quote and conservative price-only evaluation. Never turn
a public pair snapshot into an executable return or Telegram source score.
