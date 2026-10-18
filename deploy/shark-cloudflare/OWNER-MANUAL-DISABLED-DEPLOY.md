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
