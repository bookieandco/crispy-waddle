# B&W-6 Reconciliation / Audit Repair

Status: audit branch created from `main`.

## Purpose

Establish a clean reconciliation point before continuing Home Automation Fabric work. The B&W implementation branch diverged from `main`; this branch intentionally starts from current `main` so reconciliation can be reviewed without rewriting either history.

## Required invariants

- Canonical home entities/devices contain identity, normalized state, metadata, capabilities, and provenance only.
- Home Assistant transport configuration is separate from canonical entities/devices.
- Home Assistant service mapping is deterministic and allowlisted.
- Home Assistant execution occurs only after Jhadina policy governance.
- Home Assistant state/events enter Jhadina through the existing event bus; no parallel HA event bus.
- No credentials, base URLs, or transport secrets enter canonical models or event payloads.

## Next reconciliation steps

1. Compare the B&W branch against this main-based audit branch.
2. Preserve B&W Home Automation changes as a reviewed integration series.
3. Resolve any conflicts in favor of existing core-spine contracts and current main behavior.
4. Verify B&W-6.1 through B&W-6.3 after reconciliation.
5. Resume B&W-6.4 state/event ingestion only after the reconciled tree is authoritative.

## Verification limitation

Hosted CI/deployment verification may remain unavailable while repository/action quotas are exhausted. Local/static audit results must not be represented as hosted verification.
