# G30.12 — Gaming Production Release Certification & Freeze

## Release state

This phase implements and certifies the final Gaming Core software release gate.

The release gate deliberately distinguishes **software certification** from **physical hardware acceptance**. A release may not enter `frozen` state until the G28 production acceptance report is `accepted`.

## G29 product integration closed

The product facade provides:
- unified Gaming home/library projection;
- one Play decision;
- automatic measured runtime/path selection;
- controller profile/resume continuity;
- authorization required for launch/state changes;
- no assistant/controller authority bypass.

## G30 release gates

1. clean install
2. upgrade/schema migration
3. save compatibility/preservation
4. controller-profile migration
5. certified runtime rollback
6. offline operation
7. security/privacy
8. supply-chain provenance
9. performance regression
10. crash/recovery
11. G28 physical acceptance
12. immutable release manifest

## Freeze invariant

`GamingProductionReleaseGate` returns:
- `blocked` if software/audit/release prerequisites fail;
- `evidence-required` when software is ready but G28 physical evidence is incomplete;
- `frozen` only after every prerequisite including G28 is accepted.

This prevents a green CI run from being represented as GameSir, DualSense, PS5, Xbox, Homebase/TV, Sunshine or other real-device evidence.

## Recertification rule

Any future change affecting G13 input semantics, controller mappings, authorization, runtime selection, session ownership, saves, latency, supply-chain admission, console credentials, Gaming Intelligence authority, G28 evidence evaluation or G30 release gating invalidates the freeze and requires Gaming Core recertification. Hardware-affecting changes additionally require new G28 evidence.
