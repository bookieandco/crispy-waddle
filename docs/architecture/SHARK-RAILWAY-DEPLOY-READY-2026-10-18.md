# SHARK Railway deployment readiness — 2026-10-18

**Scope:** source-only compatibility repair and operator handoff. No Railway service, volume, project, workspace, billing limit, scheduler, secret or paid resource has been created. SHARK public-market research remains paper-only and continuous collection remains OFF.

## Decision and actual account boundary

The connected Railway account has **one personal workspace**, `bookieandco's Projects`, containing OverageOS and PupsonStuff Media Services. Both are unrelated to SHARK. A new SHARK project *within this workspace* would **not** give its own independent workspace-level hard spending limit. A workspace cap risks suspending PupsonStuff along with SHARK. Do **not** apply a $10 hard workspace cap to protect SHARK unless the user explicitly accepts effects on existing workloads.

The suggested **$5–$10 monthly spend target is a target, not a billing guarantee**. Before provisioning, the operator must approve a dedicated host and verify current workspace entitlement, possible separate workspace billing, spending-alert policy, included credits and charged CPU/RAM/network/volume costs. Obtain a fresh cost estimate and preserve an emergency pause/off switch. Do not modify the existing projects.

## Why the Railway storage compatibility path differs from generic Docker

Railway's documentation says service volumes are mounted **as root at runtime**, not populated at Docker build time, and recommends `RAILWAY_RUN_UID=0` for images otherwise running as non-root. The existing SHARK research worker **must not** run as root.

`ops/meme/shark_railway_bootstrap.py` is the narrow adapter:

1. Default image remains non-root UID/GID **10001**, preflight only, no HTTP port, no implicit Docker VOLUME, no cron, no Telegram API calls.
2. If a future dedicated Railway service requires root for its root-mounted volume, the operator sets **service-scoped** `RAILWAY_RUN_UID=0` and `SHARK_RAILWAY_VOLUME_BOOTSTRAP=true` on that isolated service only. Other `RAILWAY_*` project/service/environment and volume identity variables are runtime-provided by Railway.
3. The bootstrap refuses anything except the **actual explicit mount /state**, verifies its owner and existing content, rejects symlinks, group/world-accessible or unrelated preexisting files, and performs `chown(10001,10001)` + `chmod(0700)` **on the mount directory only**.
4. It irreversibly drops supplementary groups, GID and UID to **10001** before executing the existing SHARK preflight or the separately authorized public research worker. It does not use recursive chown or repair an existing unknown/root-owned SQLite database.
5. With missing Railway identity, missing mount, unapproved command or unsafe existing files, bootstrap **fails closed** before any model, provider, bot or database access.
6. A SHARK worker requires additional **service-scoped** `SHARK_RAILWAY_WORKER_ENABLED=true`, `SHARK_PUBLIC_HOST_COMMISSIONED=true`, plus a private mounted directory. Telegram output requires another `SHARK_RAILWAY_ALERTS_ENABLED=true` and preexisting independent canonical bot authorization (`--notify`, credentials, `ENABLE_SHARK_PUBLIC_ALERTS=true`). None of those grants are set by this PR.

A separate runtime may use generic non-root Docker bind mounts without `RAILWAY_RUN_UID=0`; these startup guards do not weaken existing generic Docker isolation.

## Stage 0 — Code certification (this PR)

Network-disabled CI builds the Docker image and proves both:
- Generic nonroot preflight: no implicit volume, no inbound port, no privileged worker, private SQLite survives separate ephemeral container invocations.
- Simulated Railway root-owned explicit bind mount: startup is allowed only with exact Railway-style volume and bootstrap grants, drops UID/GID to 10001, leaves `NOT_COMMISSIONED`, and can be re-run safely. Unmounted root mode must fail closed.

These tests are **not evidence of a deployed Railway volume, durable provider reboot, off-host restore, correct subscription billing or real Telegram receipt**.

## Stage 1 — Operator-only future Railway setup (not executed)

After owner budget approval, create a **new isolated SHARK project/service**, preferably in a separately billed workspace if Railway supports that for the account. Set its source to the exact approved GitHub SHA, Dockerfile path `deploy/shark-public/Dockerfile`, **one replica**, no public domain/port, and attach an explicitly named persistent volume mounted at `/state`. Never attach or modify PupsonStuff/OverageOS volumes.

Use the Docker image's default entrypoint/command for its first startup. Set on the SHARK service only:

```text
RAILWAY_RUN_UID=0
SHARK_RAILWAY_VOLUME_BOOTSTRAP=true
SHARK_PUBLIC_HOST_COMMISSIONED=false
SHARK_RAILWAY_WORKER_ENABLED=false
SHARK_RAILWAY_ALERTS_ENABLED=false
ENABLE_SHARK_PUBLIC_ALERTS=false
```

Railway must supply `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID`, `RAILWAY_ENVIRONMENT_ID`, `RAILWAY_VOLUME_NAME`, `RAILWAY_VOLUME_MOUNT_PATH=/state` at runtime. **Do not invent those IDs or manually paste private keys into the repo.** Confirm the first preflight reports `isolatedOwnerPrivateDirectory=true`, `dedicatedMountObserved=true`, `nonRootIdentity=true`, but `NOT_COMMISSIONED`.

Verify that private storage is preserved across a real container replacement and a real OS reboot using the existing `shark_final_commission.py` baseline/readback procedure. Perform an encrypted off-host restore onto a separate trusted host, document who controls the age identity, and record the recovered ledger fingerprint.

## Stage 2 — Manual genuine public-market once (separate owner authorization)

Only after Stage 1 acceptance, explicitly grant commissioned-host permission and authorize the read-only worker:

```text
SHARK_PUBLIC_HOST_COMMISSIONED=true
SHARK_RAILWAY_WORKER_ENABLED=true
```

Invoke the known privilege-dropping bootstrap, never override it with a direct root-launched Python worker:

```sh
python3 -u ops/meme/shark_railway_bootstrap.py --worker \
  --mode once --state /state/observations.sqlite3 \
  --confirm PUBLIC-MARKET-RESEARCH-ONLY
```

Read the redacted provider-count results. Even if successful, this only proves a single real public observation, not prospective 24–30-hour outcomes, early-alpha edge or continuous runtime latency.

## Stage 3 — Continuous research and private output (additional approval)

After host recovery, cost and provider-rate checks, use the same bootstrap entrypoint and the canonical worker `--mode serve --interval-seconds 180` with exactly one replica. If desired, grant private Telegram sends *separately* after confirming the approved recipient ID and private phone receipt. Nothing may consume Telegram chat messages as SHARK intelligence/AI-training data. No wallet signatures, transactions, live trading or payments are authorized.

## Release blockers

- Owner budget, Railway workspace billing isolation, and new service/volume approval are **OPEN**.
- Actual mounted runtime, shutdown/restart persistence, encrypted off-host recovery, live multi-cycle 24–30-hour outcomes, and iPhone Telegram readback are **OPEN**.
- The one-shot real provider run #39092651536 and offline suites are valuable, but **not production commissioning**.
- Keep [commissioning issue #1374](https://github.com/bookieandco/crispy-waddle/issues/1374) open until receipts are attached.
