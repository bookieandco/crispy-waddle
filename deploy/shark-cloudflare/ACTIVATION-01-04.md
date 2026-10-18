# SHARK-CLOUDFLARE.ACTIVATE.01–.04 — disabled staging / real bundle handoff

**Status as of 2026-10-18:** GitHub-only code changes. No Cloudflare app connector was available to inspect this account, its Free plan or any existing Cloudflare Worker/D1 resources. No remote infrastructure, database, worker, Cron Trigger, billing configuration or Telegram secret was created, migrated or changed. Existing SHARK Python/Railway and PupsonStuff remain untouched.

## .01 — Account and free-tier inventory (OPERATOR BLOCKED)

Use the actual owner's [Cloudflare dashboard](https://dash.cloudflare.com/) to verify the account ID, Workers plan, other Workers/Cron triggers, D1 databases, usage quotas and which PupsonStuff resources occupy the same Cloudflare account. Record the current 24-hour CPU, subrequest, D1 row reads/writes and size limits. **Do not create an upgraded plan or turn on any scheduled SHARK code**. Cloudflare Workers Free is constrained to 10 ms CPU per invocation, 50 external subrequests and 5 cron triggers/account (limits shared with other account usage). The owner must verify remaining headroom; these constraints are not proven by Node/SQLite unit tests.

## .02 — New dedicated D1 storage (OPERATOR BLOCKED)

After the owner explicitly approves a new Free-tier D1 database, create a new database named `jhadina-shark-public-free`. Use the provider-returned actual account/D1 IDs; do not reuse PupsonStuff's database or invent identifiers. The checked-in `wrangler.example.jsonc` remains invalid and disabled.

The offline helper `scripts/activation_gate.mjs` only prepares an untracked private `0600` **deploy-disabled** `wrangler.jsonc`, and it refuses fields such as routes, cron schedules, collection/alert grants, or unreviewed bindings. Example **only after real IDs exist**:

```sh
cd deploy/shark-cloudflare
node scripts/activation_gate.mjs --mode template
node scripts/activation_gate.mjs --mode stage \
  --account-id 'YOUR_ACTUAL_CLOUDFLARE_ACCOUNT_UUID' \
  --database-id 'YOUR_NEW_DEDICATED_D1_DATABASE_UUID' \
  --confirm STAGE-SHARK-FREE-DISABLED-ONLY
node scripts/activation_gate.mjs --mode review
```

The helper does not authenticate these IDs remotely or prove that the account is on Free. Never commit `wrangler.jsonc`, `.dev.vars`, tokens or plaintext D1 exports. A database creation/migration is an external persistence write and requires explicit owner authorization before execution.

## .03 — Deploy-disabled Worker rehearsal (SOURCE PROVEN; REMOTE BLOCKED)

CI verifies the Wrangler *actual* bundle with `wrangler deploy --dry-run --outdir` against synthetic account/database IDs. Per Cloudflare's documentation, dry-run compiles without live deployment. CI also tests that Worker HTTP ingress responds 404, the checked-in config has `workers_dev=false`, zero cron triggers, no routes, and all collection/private-alert grants remain false.

**After approved D1 creation**, migration for the new isolated database may be run manually:

```sh
npx wrangler d1 migrations apply jhadina-shark-public-free \
  --remote --config wrangler.jsonc
```

This writes to a remote D1 database. Do not run it for existing D1, existing customer records or without verifying account ID, Free tier and billing capacity. First actual Worker deployment must preserve `crons: []` and all three `false` gates. Require operator readback of exact Worker version/config after deploy, including absence of routes and Cron.

## .04 — Controlled public-market/CPU benchmark (REMOTE BLOCKED)

Offline unit tests use deterministic fake DexScreener/RPC replies. They cannot certify real CPU under Cloudflare's 10 ms Free limit. Once the owner separately authorizes a one-shot, run a bounded public-only sample on an approved account after setting up isolated D1; keep cron, Telegram and wallet features OFF. Capture these **actual** Cloudflare metrics (do not substitute Node wall-clock time or prior GitHub's 0.616-sec run):

- CPU time per invocation (p50/p95, max) from Cloudflare analytics; identify any free-limit failures;
- elapsed wall-clock time, and provider success, timeout, throttle/rate-limit and subrequest counts;
- D1 total rows read/written, growth, quota headroom and missing or malformed provider evidence;
- deduped same-pair 24–30h followup outcome only after real elapsed time; missing cases must be censored;
- no Telegram API messages sent, no personal Telegram inbox read, no trades and no wallet signing.

Only then review activating a five-minute Cron. **Do not enable it automatically**; returning a 404 for HTTP and no Cron means a deployed-disabled Worker remains inert. For a genuinely first-class CPU benchmark, operator must provide a Cloudflare account, service, resource IDs and analytics; these cannot be guessed or simulated as evidence.

## Source hardening also included

- Watch limit now applies to currently **OPEN** public cases, not all permanently retained cases, avoiding artificial stalls after 1,000 completed research records.
- Active cap is enforced again within the candidate loop, not just at entry.
- Telegram output quota now counts **attempts including uncertain responses**, not only Bot API acknowledged responses, and remains separately owner-disabled. Uncertain cases are never automatically retried.
- Real provider-response timestamp rule remains: no retrospective first observation from Cron start time.
- No Cloudflare system can claim the full canonical Python SHARK verification feature set, provider-origin attestation, verified alpha, executable P&L, profitable trading edge, live trades, 24–30h market results or owner-phone alert until separately proven.

## Release rule

Only merge these GitHub source changes after exact-head Cloudflare/Node test, actual Wrangler dry-run bundle, Spatial Conformance and Jhadina Launch Gate succeed. Code merge **never** means cloud account authorization, database creation, Worker deployment, Cron activation, or Telegram delivery. Keep [SHARK issue #1374](https://github.com/bookieandco/crispy-waddle/issues/1374) open for verified remote evidence and cost review.

Official documentation: https://developers.cloudflare.com/workers/platform/limits/ and https://developers.cloudflare.com/workers/wrangler/commands/workers/ and https://developers.cloudflare.com/d1/reference/migrations/.
