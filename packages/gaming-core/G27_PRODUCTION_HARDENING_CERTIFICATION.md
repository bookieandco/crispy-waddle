# G27 — Production Hardening Certification

Status: **SOFTWARE CERTIFIED**

Certified branch: `jhadina-gaming-g27-hardening`
Certified head: `4b48088f8f50d4a5e95d28b4b2957faa85cc56d4`
Gaming Core Certification run: `35536041778`
Certification job: `106145133221`

## Executed evidence

- Frozen-lockfile install: PASS
- `pnpm --filter @jhadina/gaming-core run certify`: PASS
- Gaming Core Vitest: **71/71 files, 185/185 tests**
- Turbo package build/test/type-check: **3/3 tasks successful**
- TypeScript compile: PASS

## G27 hardening domains

1. Crash/failure recovery policy with no replay of uncertain input.
2. Telemetry retention limits; no raw input payload or secret retention by default.
3. Storage quota reserve protecting safe-save capacity.
4. Contiguous schema migration planning.
5. Backward-compatible save preservation through conflict/corruption recovery.
6. Controller mapping governance behind the G13 trust boundary.
7. Certified runtime release promotion and rollback.
8. Hardware latency evidence model and regression thresholds.
9. Long-running soak gate: >=240 minutes, >=20 cycles, zero leaks, zero input-integrity errors, zero save corruption, zero unrecovered crashes.

## Cumulative production surface certified by software tests

- G16 production emulation fabric: Libretro/WASM, EmulatorJS/browser, portable offline bundle governance.
- G15 supported PlayStation runtime and G15j matrix:
  - DualSense -> Jhadina -> PS5
  - GameSir X5 Lite -> phone/Jhadina -> PS5 with generic-gamepad fallback.
- G17 Xbox home/cloud managed runtime boundary.
- G18 governed high-end emulator adapters.
- G19 unified library/resume projection.
- G20 shortest viable runtime/device path selection.
- G21 hardware input-to-photon evidence schema.
- G22 deterministic failure/recovery drills.
- G23 supply-chain/provenance and permission isolation.
- G24 gameplay observation/intelligence ledger.
- G25 assistant authorization boundary; no direct controller injection.
- G26 full device acceptance matrix.
- G27 production hardening gates.

## External mapping/runtime references admitted only as references

- `mdqinc/SDL_GameControllerDB` — controller normalization database.
- `AntiMicroX/antimicrox` — remap UX/reference.
- `streetpea/chiaki-ng` — supported PS4/PS5 remote-play reference.
- `unknownskl/greenlight` — Xbox home/cloud streaming reference.
- Dolphin / PCSX2 / RPCS3 / PPSSPP / xemu — high-end emulator definitions.

None of these references may bypass Jhadina authorization or inject post-G13 runtime input.

## Physical certification boundary

G26 deliberately refuses to mark a physical device route accepted without `hardwareObserved=true`. Therefore this report certifies the **software/runtime production-hardening implementation**, not fabricated physical-device measurements.

Final hardware acceptance still requires actual evidence from the target devices for the G26 matrix and real G21 T0->display measurements.

## Freeze rule

Any future change to G13 input semantics, G15 controller fallback, save durability, runtime admission, controller mapping governance, latency enforcement, or G27 migration/rollback logic requires:
- regression coverage,
- rerun of Gaming Core Certification,
- preservation of exact-once/no-uncertain-replay semantics,
- and new physical evidence when the changed behavior affects a G26 hardware route.
