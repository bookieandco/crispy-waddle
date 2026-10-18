# SHARK Cloudflare — owner-only GitHub verification and disabled upload

**Scope: manual source path.** This workflow does not run on push or merge. It does not create D1, run migrations, enable Cron, access Telegram, contact public Solana markets, change billing, or trade.

The owner's two supplied strings have the expected **D1 UUID** and **32-character Cloudflare account ID** shapes. They are never committed to source or placed in test logs. The tool cannot independently establish that the remote database belongs to this account until a scoped Cloudflare token authorizes a read.

## iPhone-first setup

1. Open **GitHub > bookieandco/crispy-waddle > Settings > Environments**. Create a dedicated environment named **`Shark_cloudflare_free_disabled`**; do **not** reuse **`Pupsonstuff_cloudflare_preview`**, its secrets, or its deployments. Configure manual environment reviewers if available.
2. Create a Cloudflare API token restricted to the intended account with **D1 Read** for database verification. To later upload a disabled Worker, add the narrowest available **Workers Scripts Edit/Write** permission. Don't use a global API key or paste the token into a workflow input, chat, commit, repository variable or Google Drive.
3. Save that token as the **environment secret** named **`SHARK_CLOUDFLARE_API_TOKEN`**. The credential is never printed in the workflow. Verify the existing account is on Workers Free and review shared quotas (including PupsonStuff) before selecting the upload option.
4. Open [SHARK Cloudflare Owner-Gated Disabled Deployment](https://github.com/bookieandco/crispy-waddle/actions/workflows/shark-cloudflare-owner-disabled.yml) on `main`. Choose `VERIFY_D1_ONLY` first and enter the Cloudflare account ID and existing D1 UUID from your Cloudflare dashboard. The workflow reads the Cloudflare D1 metadata and requires database name **`jhadina-shark-public-free`** and exact UUID. On mismatch it fails, protecting other app databases.
5. Only if the read-only verification passes *and* you separately approve a disabled deployment, rerun with `DEPLOY_DISABLED_SHARK` and type **`I_CHECKED_FREE_AND_ACCEPT_DISABLED_DEPLOY`**. The upload uses the exact reviewed config: `workers_dev=false`, zero Cron triggers, no routes, all collection and Telegram authorization flags false. The workflow checks the **remote** Cron list is actually empty afterward. The post-upload source gate also checks **remote binding settings** (exactly one `DB` D1 binding matching the supplied SHARK UUID, plus the three collection/alert/owner flags set to literal `false`). Any extra/unknown binding fails closed.

Cloudflare API references for the read-only gates:
- [Get D1 database](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/get/)
- [Get Worker cron schedules](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/schedules/methods/get/)

## What is not activated

Even after an approved disabled upload, no D1 migration, data collection, paper follow-up, Telegram delivery or automatic task runs. The Worker cannot yet demonstrate 10 ms CPU compliance, account-wide free quota headroom, genuine later-market observations, off-host recovery or a profitable trading edge. A *later* dedicated approval and separate source target are required for schema migration, controlled benchmarking and Cron.

If your D1 has a different name, stop and verify its identity and whether it is exclusively for SHARK; **do not** bypass the name check or silently attach to an existing PupsonStuff database.

Repo source of truth remains the disabled `deploy/shark-cloudflare/wrangler.example.jsonc` plus `scripts/activation_gate.mjs`; private `wrangler.jsonc` never enters GitHub source. Railway remains a separate fallback.

**Production status: NOT COMMISSIONED.** Issue [#1374](https://github.com/bookieandco/crispy-waddle/issues/1374) stays open.

## CERT.05–.08 — Readback limitations and evidence

This added gate is a read-only Cloudflare `GET` to `/accounts/{account_id}/workers/scripts/jhadina-shark-public-free/settings`. Both DB identity and Worker binding metadata must match; the negative-path unit tests reject arbitrary secret/service bindings, other databases, and any enabled or missing grant. An optional disabled upload is **not** certified unless both the zero-Cron readback **and** exact bindings readback pass on the same manual run.

The script-settings response does **not** independently certify that there are no Worker routes or that `workers_dev` is disabled on the Cloudflare account. Verify both in the dashboard separately. No actual Workers Free subscription, shared quota headroom, CPU duration, prospective market study, off-host encrypted restore or iPhone Telegram receipt has yet been proven. Do not enable Cron, provider collection or alerts based on this readback alone.

## LIVE.09–.12 — read-only D1 preflight and uncommissioned Free quota screening

**LIVE.09 — Account and Free plan.** An account ID and D1 UUID can be verified with a separate SHARK-scoped Cloudflare token stored in the dedicated GitHub Environment. A successful D1 identity API response does **not** verify the Workers Free plan, shared account usage including PupsonStuff, or billing. Inspect the Cloudflare dashboard separately. No unapproved subscriptions, no environment reuse.

**LIVE.10 — Disabled ingress.** An independently approved disabled upload now requires three Cloudflare readbacks: empty Cron list, only the exact dedicated SHARK D1 + three false collection/alert grants, and a Worker subdomain with enabled=false. It does NOT prove absence of zone routes, custom domains, or preview URLs. Audit these separately. Readback failures fail closed.

**LIVE.11 — D1 schema.** Both manual actions call scripts/d1_schema_preflight.mjs --mode schema-preflight. It checks name and UUID via GET then uses Cloudflare D1's HTTP POST query endpoint containing ONLY a fixed SELECT against sqlite_master. No D1 writes or migrations occur. Empty approved database returns EMPTY_APPROVED_D1_REQUIRES_OPERATOR_MIGRATION; exact six SHARK tables and index return EXPECTED_SCHEMA_OBJECTS_PRESENT_UNATTESTED. Partial schemas, unknown unrelated tables, wrong constraints fail closed. Presence does not prove migration provenance. Remote schema migration needs separate explicit owner consent.

**LIVE.12 — CPU and account-wide budget screen.** The offline script node deploy/shark-cloudflare/scripts/free_quota_gate.mjs --input /trusted/private/sample.json reads operator-entered metrics and compares to nominal Free limits: CPU below 10ms/invocation, fewer than 50 external subrequests, <=80% of 100,000 account-wide Worker requests/day, 5 million D1 rows read/day, 100,000 D1 rows written/day, 500MB/database and 5GB/account. The source screen is not a remotely attested CPU benchmark or verification of Free-plan entitlement. Even a passing screen sets cronAuthorized=false, workerCollectionAuthorized=false, telegramAuthorized=false and tradingAuthorized=false.

Fictional offline sample, **not** evidence of a real Cloudflare test:

    {
      "collectedAt": "2026-10-18T20:00:00Z",
      "sourceRef": "https://dash.cloudflare.com/REPLACE_WITH_PRIVATE_REFERENCE",
      "planReported": "FREE",
      "usage": {
        "cpuMs": 7.5, "subrequests": 12,
        "workerRequestsDay": 5000,
        "d1RowsReadDay": 100000, "d1RowsWrittenDay": 1000,
        "d1BytesPerDatabase": 20000000,
        "d1BytesAccount": 100000000
      }
    }

No account plan/Free quota receipt, representative Worker CPU benchmark, approved isolated D1 migration, public-feed sampling, off-host encrypted restore or iPhone Telegram delivery has been performed by these source changes. After separately approved migration and a representative bounded observation run, record actual dashboard and provider evidence in commissioning issue #1374. No Cron, Telegram inbox/model training, signing or trading authority from any preflight result.

Cloudflare API references: https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/ and https://developers.cloudflare.com/api/resources/workers/

## LIVE.13–.16 — scoped ingress certification (source-only)

The previous gate tested only workers.dev enabled=false. Cloudflare also exposes an independent previews_enabled flag; it must now be literal false in the remote readback. If preview URLs are enabled, the GitHub manual job **fails closed** even with workers.dev disabled. Cloudflare's public API documents both fields at https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/subdomain/methods/get/.

After an explicit disabled upload, the owner workflow additionally performs read-only inventory calls:
- GET /accounts/{account_id}/workers/domains (no enabled filter; any attached exact SHARK domain fails).
- GET /zones?account.id={account_id}&per_page=50&page=1 (requires complete page metadata and a bounded, account-matching zone list).
- GET /zones/{zone_id}/workers/routes for each visible zone; any route referencing exact script jhadina-shark-public-free fails.

These calls may require **Workers Scripts Read, Zone Zone Read, and Workers Routes Read** in the dedicated SHARK API token, plus prior **D1 Read** for the existing database preflight; a separately approved disabled upload still needs the narrowest possible Workers Scripts Write. Never reuse a PupsonStuff token, widen credentials silently, or paste keys into chat/GitHub inputs. If the token cannot enumerate the relevant zones, has pagination gaps, or returns an unrecognized schema, the job fails. The successful scoped check reports ONLY "no matching SHARK domain or route in token-visible inventory." It cannot prove the token can see every zone in the account, nor can separate readbacks establish an atomic point-in-time snapshot. Review all account zones, custom domains, and preview settings in Cloudflare before accepting zero-public-ingress evidence.

The Worker source still returns HTTP 404 for fetch requests, but a 404 response by itself is NOT ingress isolation. If an existing Worker has preview URLs or zone routes attached, stop and resolve those through a separate approved operator action. This PR never removes routes or modifies domains automatically.

No real Cloudflare API authentication, migration, disabled upload, scheduled collector, CPU/quotas benchmark, off-host restore, private Telegram read/send or trading authority was performed by this source package. The remaining activation owner step is to configure the SHARK-specific environment secret and manually run VERIFY_D1_ONLY, then review provider evidence before any disabled upload. Keep commissioning issue #1374 open.

API references:
- https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/list/
- https://developers.cloudflare.com/api/resources/zones/methods/list/
- https://developers.cloudflare.com/api/resources/workers/subresources/routes/methods/list/
