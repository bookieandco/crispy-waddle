# JHADINA ONE-RUNTIME follow-up — clean forward-port

This branch forward-ports the still-useful pieces from stacked PRs #711–#717 onto the current main after #709 merged.

## Included

- capability-aware next-task worker selection on top of the durable lease repository;
- paused tasks in the human-attention projection;
- reference-only cross-domain WorkSession lineage;
- freshness-aware capability truth:
  - READY requires fresh expiring live-runtime evidence;
  - expired READY becomes DEGRADED;
  - stale limited modes become UNKNOWN;
  - BLOCKED/DISABLED stay fail-closed;
- canonical WorkSession-task to Action Core lineage binding.

## Deliberately not copied

The older stacked implementations of leases, compute bridging, and event replay are not copied because #709 already landed stronger durable versions.

## Authority boundary

Worker capability matching, lineage references, capability health, and runtime metadata do not grant execution authority. Consequential effects still flow through Action Core policy/approval and domain executors.
