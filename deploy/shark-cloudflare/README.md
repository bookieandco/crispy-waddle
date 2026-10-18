# SHARK-CLOUDFLARE.FREE.01 → .08 — source-only handoff (2026-10-18)

**Status: IMPLEMENTED AS A DISABLED, LIGHTWEIGHT SHADOW ADAPTER. NOT DEPLOYED.**

Canonical Python SHARK, its owner-private SQLite ledger, real-market one-shot receipt and paper-only research gates stay unchanged. The Cloudflare Worker is a distinct **public-feed observation adapter**, not a line-for-line Python port. It cannot yet claim the Python engine's full Token-2022 controls, authority-cluster analysis, score calibration, behavioral learning, low-latency alpha or executable trading. None of its rows can be silently imported as canonical Python SHA-chain receipts.


## Activation handoff

The newer owner-gated, deploy-disabled Cloudflare preparation and real Wrangler dry-run instructions are in **[ACTIVATE-01-04.md](./ACTIVATE-01-04.md)**. There is still no connected Cloudflare account authorization in ChatGPT and no provisioned SHARK D1/Worker. The active case ceiling was updated to 1,000 **open** research cases, not 1,000 lifetime observations; retained D1 bytes must be monitored independently. An uncertain Telegram send now counts toward the one-attempt-per-cycle limit.

## Ordered work and exact boundaries

| Target | Source capability | Release boundary |
| --- | --- | --- |
| **.01** | Reconcile Python research invariants with official Cloudflare Workers/D1; standalone `deploy/shark-cloudflare` | Existing Railway and seven-day study preserved |
| **.02** | Module Worker `scheduled()` and fixed DexScreener public profile + boost discovery, two Solana candidates max/tick | Wrangler checked-in template has **no cron** and collector is disabled |
| **.03** | D1 migration: unique UTC cycles, bounded daily budget, public watches, observations, outcomes and alert outbox | New D1 database must be owner approved and migrations manually applied; NOT existing Supabase |
| **.04** | Fixed Solana `getAccountInfo(jsonParsed)` mint validation, legacy token program check and public DEX pair/price; quarantine invalid/incomplete data | Token-2022 and complex controls are **unsupported**, not silently labeled safe |
| **.05** | Priority 24–30h same-pool price-only follow-up; mismatched pool, provider failure and missed window are censored; no fills, P&L or entry/exit labels | Locally recorded, provider-unattested studies; separate from canonical Python receipt schema |
| **.06** | Private Telegram **output-only**, dual env authorization, owner allowlist, at-most-once outbox insert and uncertain/no-retry | OFF. No Telegram inbox/forwarded messages, no bot secret in repo |
| **.07** | Five-minute scheduled budget: <=288 cycles/UTC day, <=2 new mints, <=3 due reads, <=1000 retained watches, external calls bounded to ~12/tick; dedicated offline CI | No automatic cleanup of public evidence. Cap stops discoveries; database/CPU/requests must be monitored; 10ms free CPU limit is unproven |
| **.08** | Local-only owner-consented `age` encrypted D1 export utility, runbook and release gate | Google Drive upload and **off-host** restore require separate owner-authorized steps; no backup certification or spending claim |

## Why Workers + D1, rather than using Google Drive or Colab as a server

Cloudflare's current Workers Free limits include 100,000 daily requests, **10 ms CPU per invocation** and **50 external subrequests**. Five-minute Cron performs about 288 scheduled calls/day. The subset here uses at most two public feed requests and up to five pairs of public DEX/RPC checks per cycle (roughly 12 external requests). Network waiting isn't CPU time, but JSON processing and D1 work are. A real CPU/subrequest and provider-rate acceptance probe is required before enabling cron. The current D1 Free tier includes 5 million rows read/day, 100,000 written/day, 5 GB total storage and 500 MB per database; **D1 free row quotas are now enforced** (September 2026). These allowances apply to **the Cloudflare account**, including other Workers. See:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/

Drive is optional **encrypted off-host archive** only; Colab is for supervised experiments, not a dependable continuous collector. Existing Railway persistent-worker preparation stays as an independent fallback.

## Setup is intentionally blocked until approved

The checked-in `wrangler.example.jsonc` contains `"crons":[]`, `"workers_dev":false`, three `"false"` environment gates and an invalid `database_id` placeholder. No Cloudflare account, D1 database, migration, Worker deployment, Cron Trigger, secret or spending change was made.

**After explicit owner approval** and confirming the account is on Workers Free (avoid paid-plan upgrades):

1. Use an owner-controlled Cloudflare account and a new *research-only* D1 database, not any PupsonStuff data. Review account-wide Workers/D1 usage and existing Cron Trigger slots.
2. From `deploy/shark-cloudflare`, copy `wrangler.example.jsonc` to a private `wrangler.jsonc` file and replace the D1 UUID returned by `npx wrangler d1 create jhadina-shark-public-free`. Do not commit credentials, UUIDs, `.dev.vars`, or a production-specific config. Set `"crons":[]` and all gate vars to false for first deploy.
3. Install Wrangler on the operator's trusted workstation; apply only to the **new** D1 database: `npx wrangler d1 migrations apply jhadina-shark-public-free --remote --config wrangler.jsonc`. Confirm D1 table names and access scopes before writing.
4. Deploy a disabled/no-route/no-cron Worker only after approval. Confirm it receives **no external requests, D1 writes, or Telegram sends**.
5. Once provider terms, D1 usage, CPU duration, quotas and backup/recovery are verified, separately approve a Cron Trigger of `*/5 * * * *` and set `SHARK_CF_COLLECT_ENABLED=true`. No public route or continuous Python daemon is needed.
6. For private alerts, separately set `SHARK_CF_OWNER_AUTHORIZED=true` and `SHARK_CF_ALERTS=true`, and use secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_ID` in the **Cloudflare secret store**, not config/git. Confirm the owner receives an actual research-only message on the iPhone; Bot API acknowledgement alone is not delivery proof.
7. Validate a genuinely prospective **same-pair** 24–30h outcome. Missing window/provider failures are censored rather than reported as a profit. Shut off cron immediately if free CPU/row quota is hit or public data terms prohibit polling.

**Operator code verification:**

```sh
cd deploy/shark-cloudflare
npm run check
npm test
# Neither command contacts Cloudflare/DEX/Solana/Telegram.
```

**Encrypted local snapshot (not an automatic Google Drive backup):**

```sh
SHARK_CF_BACKUP_CONFIRM=EXPORT-SHARK-PUBLIC-ONLY \
  bash scripts/export-encrypted.sh /private/wrangler.jsonc \
  age1YOUR_ACTUAL_AGE_PUBLIC_RECIPIENT /private/new-shark-backup.age
```

The export creates a short-lived local SQL file and then age-encrypts it. Deletion is not guaranteed secure erasure on SSDs. The resulting ciphertext must be moved to approved separate off-host custody, with decryption key stored separately. Only a real decrypt/import on a second trusted machine plus matching evidence closes the recovery gate. Do not upload private keys, bot tokens, unencrypted research, or D1 auth credentials to Drive. D1 Time Travel is a separate provider recovery mechanism, not owner-controlled off-host proof.

## Strict user-facing claims and next dependencies

- **Research-only:** no live trading, signing, broadcasts, real-money transfers, launchpad automation, Telegram private-message input or AI training on Telegram content.
- **Not equivalent to Python:** Cloudflare adapter stores its own D1 public-market observations; no shared read/write to the Python `shark_live_intelligence` SQLite ledger, no fake parity claim.
- **No verified profit / lightning speed:** five-minute cron is sampling, not WebSocket/event-driven subsecond discovery. Clock and provider records remain independently unattested.
- **No commissioned production:** a passing Node/D1-schema CI proves source behavior only, not free-plan quota viability or actual Telegram phone alert delivery.
- **Free tier is contingent:** verify the Cloudflare account's plan; existing PupsonStuff Workers and D1 usage count toward shared account limits.
- **Recovery proof is pending:** the local `age` script does not transfer data to Drive, upload credentials or verify off-host restore.

Preserve [SHARK commissioning issue #1374](https://github.com/bookieandco/crispy-waddle/issues/1374) as open and record Cloudflare-specific CPU/quota/backup/phone receipts there. No deployment on behalf of the owner occurs by merging this sequence.


## Next (source-only) — Cloudflare activation `.01–.04`

See [`ACTIVATION-01-04.md`](./ACTIVATION-01-04.md) for the disabled-config staged account/D1 authorization gate, exact Wrangler dry-run test, remaining operator approvals, and genuine Cloudflare Free CPU/prospective-study acceptance. No D1 creation, deployment, Cron, billing, or Telegram activation is implied by merging this stage.
