# Gaming Core Deep Audit — G30 pre-freeze

Audit basis:
- repository Gaming Core implementation and certification notes through G28;
- handoff invariants preserved from G13 exact-once input, G14 managed sessions, G15 supported/experimental separation, G16 emulation, G17/G18 runtimes, G19-G28 hardening/commissioning;
- GitHub references already incorporated into the subsystem.

## Reconciled reference findings

### Controller mapping
SDL_GameControllerDB remains a device-normalization source. AntiMicroX remains a remapping UX/reference source only. The audit hardens the type boundary so macros, scripts and executables are not admissible mapping payloads. External mapping terminates before G13.

### PlayStation
Supported Remote Play remains separate from PS5 experimental/homebrew references. DualSense feature availability is negotiated; GameSir X5 Lite/non-PlayStation controllers use generic-gamepad fallback rather than pretending to expose DualSense-only features.

### Emulator/runtime references
EmulatorJS, Libretro/WASM and native emulator definitions remain governed by provenance, local/user-provided content, firmware/BIOS non-acquisition, explicit runtime admission and G14 resource ownership.

### Steam Achievement Manager
Remains a Steam PC utility reference with explicit approval for mutations and no permission inheritance into PlayStation/Xbox/experimental domains.

## Adjustments made by this audit

1. Added a canonical audit finding ledger.
2. Explicitly forbade macro/script/executable semantics in external controller mappings.
3. Added G29 product facade: unified home/library projection and one authorization-gated Play decision.
4. Added G30 release manifest/freeze gate.
5. G30 consumes G28 physical acceptance and cannot translate CI success into physical certification.
6. Freeze status has three states:
   - blocked — software/audit/release prerequisites failed;
   - evidence-required — software ready, G28 hardware evidence incomplete;
   - frozen — all software and physical gates accepted.

No audit blocker remains in the software architecture. Physical evidence remains an external commissioning prerequisite by design.
