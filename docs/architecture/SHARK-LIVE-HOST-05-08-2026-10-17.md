# SHARK-LIVE.HOST.05 → .08 — offline container acceptance / release hardening

**2026-10-17.** Source-only and CI-only milestone. No dedicated Railway/Vercel/RunPod host was created or modified. No paid infrastructure, persistent real-world market collector, Telegram-message ingestion, ML on Telegram content, wallet or trading authority.

## .05 — No implicit persistent-storage claims

The previous Dockerfile declared `VOLUME ["/state"]`. This can create a Docker-managed **anonymous volume**, which can be lost or orphaned when containers are replaced even though `/proc/self/mountinfo` reports it as mounted. This is a release blocker for a public-market ledger.

**Repair:** Remove the Dockerfile VOLUME statement. Operators MUST supply an explicit owner-controlled durable `/state` mount; the image never provisions storage on its own. The runtime preflight still requires an exact mountpoint, owner-only permissions, nonroot user, disk space and a separate commissioning flag. **An explicit bind mount observed in CI is not proof of production durability.**

## .06 — Restricted Docker build context

`deploy/shark-public/Dockerfile.dockerignore` is a **Dockerfile-scoped** allowlist: build context contains only the Python SHARK research / Telegram **output** integration source and that Dockerfile. Do not create a root `.dockerignore` that would unintentionally change PupsonStuff, TruckerOS, or other product builds. The image remains nonroot UID 10001, no published port, no scheduled polling and default command `--mode preflight`.

## .07 — Real container rehearsal, NO NETWORK

`.github/workflows/shark-live-intelligence-ci.yml` now has a separate Docker build-and-run gate:

1. Assert the built image has UID 10001, **zero** implicit volumes and **zero** exposed ports, and preflight-only entrypoint.
2. Run the default image with `--network none`, readonly filesystem, no capabilities, no-new-privileges, 256 MB memory limit, 64-process limit and private `/tmp`. With **no /state bind mount**, it MUST stay `NOT_COMMISSIONED` and report `dedicatedMountObserved=false`.
3. Bind a new 0700 CI-only directory to `/state` owned by UID 10001. Verify it is recognized as a mount without falsely asserting commissioning or real restart persistence.
4. In **separate network-isolated container executions**, run the existing worker in `--mode audit` and the SQLite local backup/restore drill twice. Confirm a stable SHA ledger fingerprint, local database owner-only permissions, and flags for **off-host backup / phone alert / commissioned host remaining false**.

No provider network request or Telegram send is made; CI ephemeral test containers are discarded. This only verifies across separate processes using the **same** CI bind directory—not host reboot, Docker daemon failure, data center replacement, or off-host recovery.

## .08 — Operator commissioning evidence remains blocked

The following are still **not proven** by this change and must remain open in issue #1374:

- Owner-approved isolated persistent host, cost ceiling, account permissions and shutdown plan.
- Real durable volume retained across a full host/container replacement or restart on chosen provider.
- Full encrypted **off-host** backup, restore on an unrelated host, recovery-point/time targets and lost-key recovery.
- Real SHARK Live provider cycle and measured 120–180 second latency under permitted data-source terms.
- New-worker private Telegram alert **read back on iPhone** under separate explicit owner consent.
- No personal Telegram account-reader PR #1230 commissioning, no Telegram API content used in AI/ML, and **no actual trading**.

**Release rule:** Passing offline CI may merge code-only hardening. It must **not** start `--mode serve`, turn on `--notify`, provision Railway, or change PupsonStuff/OverageOS resources.

See earlier `docs/architecture/SHARK-LIVE-HOST-01-04-2026-10-17.md` for owner commands and issue [#1374](https://github.com/bookieandco/crispy-waddle/issues/1374) for operator signoff.
