# PHONE-HOMEBASE.1 — iPhone as operator, Google as archive

**Observed owner setup (2026-10-07):** The only current Homebase device is the owner's iPhone. The Google Drive connector is authorized in ChatGPT and the account has a private JHADINA-HOMEBASE folder. The iPhone is the **control and approval surface**, NOT a Linux/Docker/24x7 compute host. The 5 TB / 400 GB plan is not independently confirmed as active.

## Actual topology today

- **iPhone + ChatGPT/Jhadina UI**: request jobs, view evidence and receipts, approve exact guarded actions, browse connected Drive, receive status alerts. iOS is not a durable background service, PostgreSQL server, or GPU worker.
- **Google Drive**: owner cloud archive and versioned/approved non-sensitive assets via the connected ChatGPT tool. Secure bulk backup via Restic and DVC via dvc-gdrive are **source adapters**, not separately authorized live hosts yet.
- **Existing GitHub Actions**: repeatable code tests and bounded scheduled execution when workflows and secrets have been authorized; ephemeral runners must not be treated as a continuously available database or as an owner approval service.
- **Existing Supabase/service providers**: retain existing production authority during staged recovery and migration. The source Homebase Postgres+MinIO+NATS architecture remains a future physical-host target, not evidence of a live machine.
- **Existing RunPod workers**: preserve only explicitly authorized research/GPU bursts with spend gates. Do not commission a new paid resource from this work.
- **Google Colab**: optional interactive/testing compute with quota, timeouts and availability limits, not an always-on backend or a production-job scheduler.

## Implemented code boundary

The shared compute package exports `assessPhoneHomebase`. It reports a mobile operator readiness profile without asserting Homebase hardware, canonical services, machine OAuth or encrypted disaster-recovery receipts. Read-only cached status is available offline. Remote job requests and owner-approval UI require authenticated owner session, network, verified gateway and independently verified durable authority; actual approvals, provider actions and spending still pass the existing Action Core and server policy.

It **never** sets `homebaseFinalCertified` or `localCanonicalRuntimeReady` true based on the presence of a phone.

## Immediate path (no local Docker or SSH commands on iPhone)

1. Keep using the connected Drive for governance files and non-sensitive archives. Maintain separate private folders for Restic and DVC; no sensitive DVC uploads.
2. Verify PR #1139 exact-head CI and close source-level safety issues before any merge.
3. Prefer the pre-existing RunPod/GitHub workflows for execution as they stand. Use independent service credentials only in a protected host/runner secret store; do not export the ChatGPT Google OAuth token.
4. Commission a short-lived, **approved existing** compute environment for a one-file safe DVC push/pull and Restic canary. No subscription, GPU purchase or always-on service should be created as a side effect.
5. If there is no approved host/worker capable of holding OAuth securely, **defer runtime OAuth**. ChatGPT Drive access is not a substitute.
6. When a real Homebase computer is acquired, move the canonical PostgreSQL/MinIO/NATS state there only after disaster-recovery, synchronization, exact-state migration and security proof.

## Explicitly blocked until external evidence

- Postgres/MinIO/NATS or Docker running continuously on iPhone
- DVC / Restic local CLI run on iOS Safari
- Dedicated machine Google OAuth as completed
- Live database backup or restored PostgreSQL database
- Supabase/RunPod cancellations or replacement claims
- Unattended Google Colab jobs as guaranteed reliable workers
- Trading, public posting, external communications or paid resource provisioning without existing approval gates

This refines `docs/JHADINA_HOMEBASE_1_10.md` without creating a competing canonical infrastructure layer.
