# SHARK-CLOUDFLARE.ACTIVATE.01–.04 — prepared, gated, NOT commissioned

**October 18, 2026 — Source-only activation closeout.** User reports the Cloudflare setup was created; account plan, D1 creation and ownership are not yet verified through a connected Cloudflare management tool. No direct Cloudflare account connector is available in this chat. The owner has an earlier Cloudflare workflow for PupsonStuff; it must **not** be silently reused for SHARK. No new Worker, D1 database, Cron Trigger, payment plan, GitHub secret, scheduled collector or Telegram message has been created.

## 01 — Cloudflare account ownership and actual Free limits (external)

Cloudflare **Free** for Workers currently documents **10ms CPU per invocation**, **50 subrequests**, **100,000 requests/day**, **5 Cron Triggers per account**. D1 has shared account-wide limits and enforced free quotas. An existing Cloudflare account may already run PupsonStuff services, so Free-tier usage must be checked across the whole account. Do not infer entitlement from existing DNS, Pages, account name or a dashboard screenshot. Provider docs:

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/

**Before remote actions**, owner must inspect Cloudflare Dashboard > Workers & Pages > Usage (plan, CPU, Worker requests and Cron slots), D1 > Usage (reads, writes, bytes and available database slots) and Billing. Verify no paid auto-upgrade or unwanted new charge, and no impact on existing services. Approval of free-first coding isn't authorization to migrate other Cloudflare resources or upgrade billing.

## 02 — Dedicated research-only D1: verified identity, no remote create yet

Owner must authorize a new **SHARK-specific** D1 named `jhadina-shark-public-free`; do not point at PupsonStuff or Jhadina's shared D1. The official command after verifying the account is `npx wrangler d1 create jhadina-shark-public-free`; it is an **API mutation** and should only be run after approval. Wrangler returns an actual new database UUID. Use a narrow-scoped Cloudflare API token with Workers/D1 permissions on the intended account; never paste it into Git, CI logs, user-facing output or unencrypted Drive.

Source-only validated commands, using an already owner-verified **existing** account and freshly created SHARK D1:

```sh
cd deploy/shark-cloudflare
node scripts/activation_gate.mjs --mode template
node scripts/activation_gate.mjs --mode stage \
  --account-id <YOUR_32_HEX_CLOUDFLARE_ACCOUNT_ID> \
  --database-id <NEW_SHARK_ONLY_D1_DATABASE_UUID> \
  --confirm STAGE-SHARK-FREE-DISABLED-ONLY
node scripts/activation_gate.mjs --mode review
```

The private `wrangler.jsonc` is created **exclusively** with owner-only file permissions, cannot overwrite an existing config and is gitignored. Review output includes `accountVerifiedByCloudflare=false`; an ID supplied on the command line does not independently prove ownership or Free eligibility.

## 03 — Disabled deploy and zero-ingress guards

The GitHub source CI uses a **synthetic** 32-character account tag and D1 UUID and invokes the actual `wrangler deploy --dry-run` bundler, with no authentication or network calls to Cloudflare's API. It does **not** provision, deploy, modify runtime bindings, migrate or send alerts.

Only after actual identity/plan/ownership and D1 verification, operator may manually inspect and apply migration `0001_public_only.sql` **to the newly approved SHARK database only**, e.g.:

```sh
npx wrangler d1 migrations list jhadina-shark-public-free --remote --config wrangler.jsonc
npx wrangler d1 migrations apply jhadina-shark-public-free --remote --config wrangler.jsonc
```

The deliberately reviewed production config must still contain `workers_dev=false`, no routes, `triggers.crons=[]`, `SHARK_CF_COLLECT_ENABLED=false`, `SHARK_CF_ALERTS=false` and `SHARK_CF_OWNER_AUTHORIZED=false`. Verify these gates immediately before the separate owner-approved first **disabled** `wrangler deploy --config wrangler.jsonc`; deploying to a real account is not done by this PR or by CI.

## 04 — Benchmark receipt and activation boundary

Real Worker CPU under Cloudflare's Free 10ms limit, actual request/subrequest usage, D1 rows read/written, storage growth, existing account quota sharing, provider rate limits, and a real prospective 24–30h paper outcome **cannot be measured by offline Node tests or Wrangler dry-run**. The source tests only prove fail-closed pathways, bounded code logic, and no fake self-attestation.

After separately authorized disabled deployment, accept only actual Cloudflare platform metrics from the deployed Worker account and supervised *explicitly permitted* test invocations. Do **not** enable a five-minute Cron Trigger until the free-plan CPU limit is measured under real representative D1 and public-feed work. Note the first enabled Cron change may take time to propagate; use Cloudflare's Cron Events and Worker analytics to verify actual cycles.

Use this minimal evidence record before enabling the schedule:

| Gate | Minimum verifiable evidence | Source-only state |
| --- | --- | --- |
| Account plan and shared quotas | Cloudflare dashboard/API account Free, existing workload usage, 5-Cron-slot availability | **Unknown** |
| New isolated D1 | UUID owned by right account; only SHARK public-only schema; successful migration with no other DB writes | **Not remotely verified** |
| Disabled Worker | Actual deployed version with zero Cron, no routes and all three flags false; one verified no-op response | **Only CI dry-run** |
| Cloudflare CPU and subrequests | Real Worker measurements within the Free account's actual CPU/subrequest limits; D1 read/write counts | **Unmeasured** |
| Prospective outcome | Real future 24–30h same-pool public observation, with timestamps and missing cases censored | **Not collected by Cloudflare** |
| Private Telegram output | Separate double consent, actual owner-phone receipt, no message-input processing | **Disabled** |
| Backup | Owner-approved off-host encrypted copy, second-host decrypt and restore | **Unverified** |

## Fixes before first release

The previous Worker counted all historically retained observations toward a `maxWatch=1000` admission ceiling, so future discoveries could stall. It now limits **active OPEN** cases to 1000 while retaining closed cases for research. This is not a promise of unlimited free storage: D1 disk occupancy still grows, so an operator must monitor D1 capacity and approve a future archival/retention policy before saturation.

The previous alert budget counted only **acknowledged** sends and could attempt another message after an uncertain first send. Now **all attempted** sends, including uncertain failures, consume the maximum-one-per-cycle budget. At-most-once per mint is preserved in D1.

## Operational constraints

No private Telegram history is ingested, no Telegram AI training, no wallet, trade, broker, exchange or token-launch authority. Workers is still a lightweight **public-market observation adapter**, not full Python SHARK intelligence/risk parity or a subsecond sniping engine.

Keep [issue #1374](https://github.com/bookieandco/crispy-waddle/issues/1374) OPEN. Production activation requires explicit user approval and a verified Cloudflare connection or operator-owned credentials; source-only merged code does not establish either.
