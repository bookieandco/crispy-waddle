# G27 Gaming Production Hardening Certification

Status: SOFTWARE HARDENING CERTIFIED — PHYSICAL DEVICE ACCEPTANCE PENDING

Certified branch: `jhadina-gaming-g27-hardening`
Certified commit: `4b48088f8f50d4a5e95d28b4b2957faa85cc56d4`
Certification workflow: Gaming Core Certification
Workflow run: `35536041778` (run #170)
Certification job: `106145133221`
Result: SUCCESS

## Scope closed

G27 closes the software production-hardening implementation across the cumulative Gaming Core surface carried by this branch:

- G16 universal emulation production fabric, controller normalization, saves, browser/offline boundaries and acceptance matrix.
- G15 supported PlayStation Remote Play lane and G15j DualSense + GameSir X5 Lite controller acceptance definitions.
- G17 Xbox home/cloud managed runtime boundary.
- G18 governed high-end native emulator admission.
- G19 unified player-facing library/resume projection and controller-mapper governance.
- G20 measured shortest-path device/runtime routing.
- G21 hardware input-to-photon evidence schema and minimum-sample gate.
- G22 deterministic recovery drills with no uncertain-input replay.
- G23 artifact provenance, license, digest, executable approval and permission isolation.
- G24 observation/evidence ledger.
- G25 assistant planning with authorization for state-changing operations and no controller injection.
- G26 full physical-device acceptance matrix.
- G27 schema migration, runtime rollback, storage reserve, telemetry minimization and long-running soak gates.

## Preserved G13 invariants

This certification does not replace G13BC. The G13 exact-once input-stack freeze remains authoritative. In particular:

- external SDL/AntiMicroX mappings terminate before G13 runtime admission;
- assistant/intelligence paths cannot directly inject controller actions;
- recovery never replays uncertain consumed input;
- disconnect/reconnect retains G13 sequence and uncertainty semantics.

## Certification evidence

Dedicated Gaming Core CI completed successfully:

- frozen pnpm workspace install: SUCCESS
- `pnpm --filter @jhadina/gaming-core run certify`: SUCCESS
- strict TypeScript check: SUCCESS
- full Gaming Core Vitest suite: **71 passed / 71**
- Gaming Core tests: **185 passed / 185**
- Turbo build/test/type-check: **3 successful / 3**

The first cumulative run exposed one TypeScript literal-widening error in the emulator controller mapping. Commit `4b48088f8f50d4a5e95d28b4b2957faa85cc56d4` repaired that defect; run #170 is the green post-repair certification.

## Production hardening invariants

1. Schema upgrades must be contiguous; version gaps fail closed.
2. Runtime rollback may target only a previously certified release.
3. Normal writes cannot consume the reserved safe-save storage budget.
4. Default gaming telemetry retains neither raw input payloads nor secrets.
5. A production soak requires at least 240 minutes and 20 session cycles.
6. A soak fails on any session leak, orphaned resource, input-integrity error, save corruption or unrecovered crash.
7. Executable runtime/core artifacts require provenance, license, digest and explicit approval.
8. Steam, PlayStation, Xbox, experimental-PS5 and emulation permission domains do not inherit one another.
9. G26 acceptance cannot pass from software simulation alone; `hardwareObserved` is mandatory.

## Physical acceptance boundary

G27 software hardening is complete. The following claims are deliberately **not** made by this certificate because they require physical devices and measured runs:

- GameSir X5 Lite on the target iPhone/phone path;
- DualSense USB and Bluetooth;
- Homebase -> TV direct path;
- Sunshine/Moonlight over the target LAN;
- browser gamepad/offline behavior on target browsers;
- PS5 Remote Play with DualSense;
- PS5 Remote Play with X5 generic-gamepad fallback;
- Xbox home/cloud streaming on target hardware;
- real G21 T0-to-display latency measurements;
- real 240-minute production soak evidence.

Those are represented by G21/G26/G27 evidence gates so they cannot be silently certified by unit tests.

## Freeze rule

Changes to G16-G27 production behavior require:
- regression coverage for the changed invariant;
- a green Gaming Core Certification run;
- preservation of the G13BC input freeze;
- new physical evidence when a change affects a G21/G26 hardware route.

G27 closes the software Production Hardening phase.
