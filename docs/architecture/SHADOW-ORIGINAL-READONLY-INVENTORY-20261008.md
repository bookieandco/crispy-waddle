# SHADOW original state read-only inventory — Supabase-independent

Date: 2026-10-08. Related [Money commissioning #1178](https://github.com/bookieandco/crispy-waddle/issues/1178), [SWLC recovery #1110](https://github.com/bookieandco/crispy-waddle/issues/1110).

The old `shark-shadow-runpod-diagnostics.yml` only searched for an *already running CPU* Pod named `jhadina-shark-shadow`. It could never determine whether any of the eight stopped Shadow-named Pods or independently stored Network Volumes remained.

This **strictly read-only workflow** uses an existing RunPod API secret on an existing GitHub Actions runner: `runpodctl pod list --all --compute-type CPU/GPU -o json`, `runpodctl network-volume list -o json`. These commands do not start, stop, create, resize or delete compute or storage. An absent key, CLI failure, or unavailable inventory fails closed.

Only allowlisted metadata (Pod ID/name, status, compute type, linked Network Volume ID, storage volume ID/name/size) enters the 7-day GitHub Actions artifact. Raw API payloads, IPs, logs, environment variables, tokens, SSH credentials and application data stay unuploaded. The artifact is **not an encrypted database backup**.

**Recovery next step if a candidate volume exists:** on owner-authorized existing compute/host, examine original data, create a consistent encrypted backup to Google Drive, and perform independently validated isolated restoration with matching hashes, row counts and lineage. Starting even a stopped zero-GPU Pod can incur costs and requires explicit owner approval.

**If no Pod/volume matches:** status stays `POD_METADATA_ONLY_ORIGINAL_DATA_UNVERIFIED`, never a declaration that old data is permanently lost. The new forward-only Money lineage from PR #1180 remains separate.

**No Supabase, broker, wallet or billable RunPod resource provisioned.**
