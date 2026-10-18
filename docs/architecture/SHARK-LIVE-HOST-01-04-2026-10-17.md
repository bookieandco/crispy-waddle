# SHARK-LIVE.HOST.01 → .04 — isolated-host package and remaining acceptance

**Date:** 2026-10-17. **Status:** Code prepared, NOT commissioned. No paid host, persistent volume, credential connection, Telegram-message read, automation, trade or wallet permission was created.

## .01 — Host isolation

Connected inventory: Vercel serves Jhadina Web, not a persistent worker; Railway has OverageOS (empty) and PupsonStuff Media Services (unrelated services without an observed attached volume). SHARK Shadow's watchdog is failing. Do **not** place this worker in either existing project or claim it is running.

`deploy/shark-public/Dockerfile` is a **build artifact**, not an auto-deployment. It uses Python 3.12 and a non-root UID/GID 10001, no exposed port, no web handler, no private Telegram account client, no scheduler, no trade integration and a preflight-only default command. It installs a standard `age` binary for operator-approved local encrypted snapshots.

`ops/meme/shark_host_acceptance.py --mode preflight` checks directory ownership and permissions, free space (at least 128 MiB), non-root runtime, exact observed mountpoint and explicit `SHARK_PUBLIC_HOST_COMMISSIONED=true`. Even when all pass, it reports `LOCAL_PRECHECK_ONLY_EXTERNAL_CERTIFICATIONS_REQUIRED` and does **not** assert a working off-host backup, preserved disk after restart, successful public feed, phone alert or continuous operation. Never treat an environment variable as a substitute for operator proof.

The operator must select a dedicated free/approved-cost host, record the project/service name, approved budget, source commit, isolation policy, mount ID, restart/redeploy persistence and shutdown procedure. Using Railway would require a **new isolated service with its own volume and billing approval**; that has NOT been created.

## .02 — Real local age encryption, not yet off-host

Building on `shark_live_commission.py`'s online SQLite snapshot, `shark_host_acceptance.py --mode encrypt-local` uses **actual** `age` CLI public-recipient encryption (no homegrown crypto) to create an exclusive 0600 local ciphertext archive, then deletes its temporary plaintext SQLite snapshot. `--mode decrypt-check` decrypts the archive into a separate private temporary directory, validates SQLite structure, checks public-only SHARK rows and matches the complete SHA-256 ledger fingerprint. CI installs the real age binary and exercises a real round trip. A local archive and a same-host decrypt are **not** an encrypted off-host disaster recovery proof.

Example on a **trusted owner machine** that has already stored private, public-only research records:

```sh
python3 ops/meme/shark_live_commission.py --mode recovery-drill \
  --state /absolute/private/observations.sqlite3
python3 ops/meme/shark_host_acceptance.py --mode encrypt-local \
  --state /absolute/private/observations.sqlite3 \
  --encrypted-out /absolute/private/backup-001.age \
  --recipient age1YOUR_ACTUAL_PUBLIC_RECIPIENT
# Save the fingerprint in owner-private operator evidence (not as a secret).
python3 ops/meme/shark_host_acceptance.py --mode decrypt-check \
  --archive /absolute/private/backup-001.age \
  --identity /absolute/secret/age-identity.txt \
  --expected-fingerprint YOUR_SHA256_FINGERPRINT
```

The identity is a **private decryption key**. Keep it outside repo, GitHub Actions, chat, logs and backups that store the ciphertext. A valid fingerprint verifies a local ledger match, not who provided the source data. Avoid deriving a key from a weak password. For actual recovery, transfer only the **ciphertext** using an approved, access-controlled remote destination, then decrypt/verify on a different isolated machine and document revocation and restore time; not implemented/claimed here. Plaintext temporary file deletion does **not** guarantee secure physical erasure on flash storage.

## .03 — Prospective one-shot public-feed acceptance

The operator may explicitly request `--mode public-once` only on a separate protected mount, with non-root UID, adequate free disk, `SHARK_PUBLIC_HOST_COMMISSIONED=true` and this literal opt-in:

```sh
python3 ops/meme/shark_host_acceptance.py --mode public-once \
  --state /state/observations.sqlite3 \
  --confirm SHARK-PUBLIC-MARKET-ONLY
```

This delegates to the existing bounded SHARK public-only worker `--mode once --confirm PUBLIC-MARKET-RESEARCH-ONLY`. It does **not** read personal Telegram messages or score their authors. One-shot duration is locally measured; no constant 120-second cadence, provider rate-limit reliability, token safety or independent price-source attestations are inferred. No money/trades/wallets.

The non-root container image's default preflight is safe without network. A *manual* operator build, **not performed here**, would use:

```sh
docker build -f deploy/shark-public/Dockerfile -t shark-public:manual .
# Mount a dedicated private persistent /state volume owned by UID 10001
# First launch defaults to preflight, does not start polling.
```

Do not set `SHARK_PUBLIC_HOST_COMMISSIONED=true` or run the continuous `serve` command until private storage, reboot/restart behavior and provider evidence have been operator-certified. Never deploy to an unrelated live PupsonStuff service.

## .04 — Private Telegram output requires separate authorization

The worker already reuses the allowlisted bot **send-only** path, not Telegram account listening. Alerts are disabled unless **all** of the following exist on an approved host: valid `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USER_ID`, `ENABLE_SHARK_PUBLIC_ALERTS=true`, an explicitly chosen `--notify` route, and this new one-shot second opt-in:

```sh
python3 ops/meme/shark_host_acceptance.py --mode public-once \
  --state /state/observations.sqlite3 \
  --confirm SHARK-PUBLIC-MARKET-ONLY \
  --private-alert-confirm SHARK-OWNER-PRIVATE-RESEARCH-ALERT
```

No message is guaranteed: a valid provider mint and a **new** deduplicated alert event must exist. A send attempt is not proof the phone received it. The real Telegram phone readback, verified current operator scope and uncertain-delivery suppression remain pending and must be recorded in issue #1374. The code never imports private Telegram chats as market data and never authorizes trading.

## Strict commissioning gates

| Stage | Evidence |
| --- | --- |
| Source-only deployment package | Dockerfile + host preflight, no start/release |
| Local age ciphertext round trip | Real age CLI integration in exact-head CI, conditional on successful run |
| Dedicated persistent, private host | **BLOCKED** until owner approves target and costs |
| Host restart and volume retention | **BLOCKED** until observed on selected host |
| Off-host encrypted backup/restore | **BLOCKED**; code implements local only |
| Real public feed on this worker, measured latency | **BLOCKED** until host operator acceptance |
| Owner-private alert arriving on iPhone | **BLOCKED** until separate opt-in and phone readback |
| Personal Telegram reader | **DISABLED**, PR #1230 / issue #1238 and API data-use review |
| Actual investment/trading | **NOT AUTHORIZED** |

No GitHub Actions continuous monitor, paid service, domain, Supabase mutation, Telegram message collection, private-session credential, spending or wallet activity is created by this target.

Handoff: [SHARK commissioning issue #1374](https://github.com/bookieandco/crispy-waddle/issues/1374).
