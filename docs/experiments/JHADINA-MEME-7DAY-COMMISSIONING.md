# SHARK seven-day memecoin commissioning handoff

Experiment: JHADINA-MEME-20261013-7D-001
Window: 2026-10-13T22:50Z to 2026-10-20T22:50Z
Mode: public read-only data, shadow abstention, offline paper simulation.
No real orders, keys, paid services, verified rug oracle or signing.

## Verified components and strict limits

1. DexScreener profiles/boosts poll + real pair/price/liquidity observations,
   not comprehensive first-mint discovery or second-level sniping.
2. GitHub cron, data-only branch and hash receipts: best effort; scheduling
   can be delayed/dropped. Hashes are auditable, NOT tamper-proof receipts.
3. Solana mainnet mint metadata lookup through official RPC then fixed free
   PublicNode fallback, max one mint per run. Mint/freeze authority and top
   token-account concentration do NOT verify LP control or wallet clustering.
   Provider errors remain UNVERIFIED; a crash alone is not a confirmed rug.
4. Prospective SHADOW_NO_TRADE evidence is sealed only for genuinely new
   current-cycle cases. Older entries are not backdated. 24-hour follow-ups
   are censored if pools change and are non-executable spot observations.
5. Offline paper model requires independent safety coverage and point-in-time
   DEX route quote plus Money Core paper authority. Incomplete route or
   unsellable token = NO_FILL, never a fabricated profitable exit.
6. Public iPhone-readable digest stored on the experiment data branch.
7. Private owner Telegram daily digest code exists but is intentionally OFF
   unless GitHub Actions variable ENABLE_SHARK_MEME_DIGEST=true is explicitly
   configured; existing owner-only secrets must also work.

## Gates remaining before declaring complete autonomous paper sniper

- Commission legitimate fast on-chain mint/Pump lifecycle stream and proven
  health on an appropriate always-on host; GitHub cron cannot react in seconds.
- Verify liquidity ownership/withdrawals, sellability, mint extensions,
  independent owners and funders, developers, migration semantics and actor history.
- Wire canonical SHARK actor-aware assessment to Money Core paper risk and durable
  state with scheduler identity and independent authorization.
- Obtain real route-executable pre/post migration quotes including slippage,
  partial fills, priority fees, failed quote and exit conditions.
- Build and verify durable attribution, learning, false-alarm labels and missed
  opportunity analysis using genuine available-at timestamps.
- Run several unattended scheduled cycles and restoration/failure tests; check
  final Oct 20 cutoff and prove self-disable or perform owner stop.
- Only after seven elapsed days, score true prospective predictions and warnings.
  Never claim missing observations are wins or confirmed non-rugs.

Success of offline CI or sampled market data does not certify production
memecoin trading. Real money remains categorically outside this experiment.

Test:
python -m unittest discover -s ops/meme -p 'test_*.py' -v
