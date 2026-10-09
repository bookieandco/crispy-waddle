# MONEY-FORWARD-ONLY — Supabase deferred, portable Memory and separately originated paper research

**Date:** 2026-10-08. Owner-approved objective: continue source work without paid SWLC upgrade or forged recovery and without entering live trading. Repo `bookieandco/crispy-waddle`.

## Decision: no Supabase lock-in for new paper research

Supabase is **not an inherent Money Core dependency**. This repo already includes:
- `infrastructure/homebase/docker-compose.yml`: locally persistent PostgreSQL 17, MinIO, Valkey and NATS bound to loopback. It requires a **real persistent host disk**, verified offsite backup and reboot readback; the phone is a control surface, not the uninterrupted server.
- `infrastructure/portable/docker-compose.yml` and `scripts/jhadina-portable-runpod-postgres.py`: portable PostgreSQL staging on an **existing authorized RunPod Network Volume**, with localhost database and private Vercel-OIDC Memory gateway. Provisioning a new paid RunPod Pod or Network Volume is **not authorized by this coding PR**.
- `services/jhadina-portable-memory-gateway/app.py`: read-only `/healthz` probe verifies actual PostgreSQL availability; memory writes use independently verified OIDC scope, never an anonymous open memory endpoint.
- `apps/jhadina-web/src/lib/storage/createMemoryStorage.ts`: `JHADINA_MEMORY_STORAGE_PROVIDER=oidc_gateway` and `JHADINA_MEMORY_GATEWAY_URL=<secure HTTPS gateway URL>` explicitly select portable Memory. Production cannot fall back to `InMemoryStorage`.
- `apps/jhadina-web/src/lib/routes/handlers.ts`: `/api/health` performs a Memory probe and returns true readiness only on success, with deployed SHA. Keep existing scheduler's exact SHA + durableMemory checks; do not short-circuit them.

The SWLC incident [#1110](https://github.com/bookieandco/crispy-waddle/issues/1110) remains `DEFERRED_AUDIT_REPAIR` and unusable while read-only SQL yields SQLSTATE `57P03`. **Existing SWLC history, Auth, Edge and cross-system receipts stay blocked.** Running portable Money or portable Memory does not mean `SUPABASE-CROSS-SYSTEM.9` was recovered. Preserve the original project and database files. A future migration requires source/target count and content reconciliation, authorization/RLS review and isolated restore, not an implicit authority swap.

## Coding in this PR

- `packages/money-core/src/money-forward-only-commissioning.ts`: new **separate** `NEW_FORWARD_ONLY_NO_HISTORICAL_RESTORE` lineage, for NEW observations only. Original Shadow proof remains `false`, `historicalPerformanceCertified` remains `false`, `finalCertification` is always `NOT_ISSUED`, and `canExecute/canAuthorizeLive` always false.
- Admission refuses fake/historical Shadow import, disabled live protections, volatile storage, incorrect exact deployed SHA, missing durable host mount or restart receipt, unreachable portable Memory, unauthenticated/unknown feed entitlements, missing STOCK/FOREX/OPTIONS/METALS read-only canaries, future market observations and unknown options contract semantics. Market/feed entitlement ID strings are **claims** until checked with actual providers by independent reviewer.
- **Collector bootstrap is separate from performance certification**. With four real source receipts and real durable memory, the research evidence bundle can reach `COLLECTOR_REVIEW_REQUIRED` even before any matured 7d grade exists. After actual six-horizon outcomes, 3 independent advancing cycles, complete ledger readback, a bundle can reach `PAPER_EVIDENCE_REVIEW_REQUIRED`. Neither status is production commissioning, unattended worker enablement or authorization to trade. The original `MONEY-FINISH.FINAL` gate remains unchanged.
- `scripts/money-portable-production-probe.py`: bounded external HTTPS read-only preflight for real Vercel `/api/health` plus separately hosted portable Memory `/healthz`. Requires **exact current main commit** and memory ready. Its best result is `PORTABLE_WEB_PROBE_REVIEW_REQUIRED`, not production-certified. No tokens or private write endpoints called.

## What can be done while SWLC is unavailable

1. **Read-only RunPod inventory** of the original stopped Shadow Pods/Network Volumes (do not create Pod or volume). Record original Pod ID, volume ID, owner, host storage persistence. If the originals exist, independently restore old data with real hashes; if not, preserve `ORIGINAL_DATA_UNAVAILABLE` and never label new forward data as recovered.
2. **Find existing authorized persistent compute**. A phone-only browser, an ephemeral Vercel function, or GitHub Actions runner cannot be the always-on state store. Before any migration of Memory, commission a real private PostgreSQL/Memory gateway on a persistent host, verify OIDC issuer/audience/owner claims, restart and independent backup restore. A RunPod Pod can incur costs; do not start a new one without explicit approval.
3. Configure Vercel **only after** that gateway is healthy. Set `JHADINA_MEMORY_STORAGE_PROVIDER=oidc_gateway`, `JHADINA_MEMORY_GATEWAY_URL` to the exact secure endpoint; remove or isolate conflicting hosted keys after safe reconciliation. Deploy exact main. Check `/api/health` HTTP 200 with `durableMemory=ready`, `environment=production` and expected SHA. If no reachable gateway, deploy admission remains blocked, rather than reporting false health.
4. Independently prove licensed read-only STOCK/FOREX/OPTIONS/METALS feeds. Treat metals as informational quotes, not tradeable bid/ask where no broker price is available. Verify source rights, options settlement, corporate actions, timestamps, missing intervals and bid/ask spread.
5. Start a **new zero-history** paper collector on existing authorized durable host; record forward observations and preserve the original Shadow history as unavailable. Keep missing horizons unresolved. Use `MoneyLocalForwardJournal` and `gradeMoneyForwardHorizon` only on correctly matured point-in-time quotes. Confirm crash/reboot+readback and independent backups; obtain at least 3 distinct advancing watchdog cycles.
6. Independent reviewer verifies original restore separately (if it exists), market-data rights and runtime. Issue a *separately scoped forward-only paper certification* only after genuine evidence; never claim historical profit or `MONEY-FINISH.FINAL` based on synthetic/staged receipts.

## Operator-only read-only Vercel preflight

```sh
python3 scripts/money-portable-production-probe.py \
  --web-origin https://crispy-waddle-jhadina-web.vercel.app \
  --gateway-origin https://YOUR-AUTHORIZED-PORTABLE-GATEWAY \
  --expected-head "$(git rev-parse origin/main)"
```

No default gateway URL can be safely invented. The current production Vercel deployment is older than `main` and its SWLC-bound Memory returns HTTP 500; the production scheduler correctly refuses worker invocation. **Do not create an always-on worker on Vercel** or pretend that healthy UI implies persistent paper grading.

## Unresolved gates / audit repair

- `SUPABASE-DB.2 → SUPABASE-CROSS-SYSTEM.9`: marked `AUDIT_REPAIR_DEFERRED_57P03` on [#1110](https://github.com/bookieandco/crispy-waddle/issues/1110). Source/tests may continue, real SWLC certification cannot.
- `MONEY-COMMISSION.RESTORE`: stopped Shadow Pod/Volume original physical data not proven; [#1178](https://github.com/bookieandco/crispy-waddle/issues/1178).
- `MONEY-COMMISSION.FEEDS`: real provider entitlements and sample invoices/receipts not proven.
- `MONEY-COMMISSION.PAPER`: no authorized live machine original durable readback or 15m through 7d actual complete grades / 3 real cycles.
- `MONEY-COMMISSION.FINAL`: stays `NOT_ISSUED` until external independent evidence.
- `Vercel production`: no confirmed deployed exact merged main; existing production health was SQLSTATE 57P03-gated. Do not promote unverified deployment.

The PR adds code and proof barriers, **not a claim of automated performance, recovered money, live market observations or restored cross-system database**.
