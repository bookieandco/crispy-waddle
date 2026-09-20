# G16-EMU.2 Universal Libretro/WASM Runtime Certification

Status: COMPLETE FOR G16-EMU.2 CODE SCOPE

Certified code commit: `cd13cde083e2740a1600fed231219095aa2a7b50`
Gaming Core Certification run: `35534941079` (run #133)
Certification job: `106142165484`
Result: SUCCESS

Observed results:
- Test files: **58 passed / 58**
- Tests: **136 passed / 136**
- Turbo tasks: **3 successful / 3**
- Frozen pnpm workspace install: **success**
- Compared with `jhadina-gaming-g16emu1`: **6 commits ahead, 0 behind**

## G15f-X5 hardware profile

The Gaming Core now defines two PlayStation acceptance controller profiles:

### DualSense
Path: `DualSense -> Jhadina -> PS5`

Capabilities include:
- buttons, axes and d-pad;
- analog/adaptive triggers;
- advanced haptics;
- gyro/motion;
- touchpad;
- wired USB and Bluetooth.

Negotiation result for the default PS5 Remote Play requirement: `full-dualsense`.

### GameSir X5 Lite
Path: `GameSir X5 Lite -> phone -> Jhadina -> PS5`

The standard X5 Lite profile is represented as:
- wired phone USB-C transport;
- Hall-effect sticks;
- buttons, axes and d-pad;
- digital trigger input;
- no claim of DualSense-only adaptive-trigger, advanced-haptic, gyro or touchpad capability.

Those missing enhancements are optional. The profile therefore remains allowed for standard controller input and negotiates to `generic-gamepad` rather than being rejected.

The exported `PLAYSTATION_ACCEPTANCE_CONTROLLER_MATRIX` is the canonical future G15j matrix and must test both paths when supported PS5 Remote Play integration is implemented.

## G16-EMU.2 architecture

The new `UniversalLibretroWasmRuntimeDriver` is a managed G14 emulator runtime built on the G16-EMU.1 source-admission boundary.

Runtime path:

`GameLibraryEntry -> LibretroWasmCoreRegistry -> audited retroemu/libretro source -> approved content provider -> installed WASM core -> UnifiedGamingSession`

### Core registry

The current pinned registry describes cores for:
- NES / Famicom
- SNES
- Game Boy
- Game Boy Color
- Game Boy Advance
- Nintendo 64
- Genesis / Mega Drive
- Master System
- Game Gear
- Atari 2600
- Atari 5200
- Atari 7800
- Atari 8-bit
- Atari Lynx
- PC Engine
- PC Engine CD
- Neo Geo Pocket
- WonderSwan
- ColecoVision
- Vectrex
- ZX Spectrum
- MSX
- PlayStation

### Admission invariants

- The `retroemu` source must pass the G16-EMU.1 independent candidate audit.
- Explicit user approval is required before the runtime becomes eligible.
- The runtime never downloads ROMs.
- The runtime never downloads BIOS/system ROMs.
- Game content must already resolve through an approved content provider.
- Required BIOS/system ROMs must already be available locally through the host boundary.
- Missing required firmware blocks launch.
- Optional firmware does not falsely block systems that have an accepted fallback path.
- Ambiguous extension-only resolution is rejected rather than guessing the console.
- System metadata can disambiguate shared disc/container extensions.
- The selected WASM core must already be installed and admitted.
- Runtime teardown flushes saves before stopping the emulator host.
- The driver participates in the existing G14 `UnifiedGamingSession` resource lifecycle.

## BIOS policy examples

- PC Engine CD requires a user-provided `syscard3.pce`.
- ColecoVision is represented as requiring a user-provided system ROM.
- PlayStation firmware is modeled as optional for the current PCSX-ReARMed/HLE path.
- Systems with free/bundled replacement firmware do not trigger proprietary firmware acquisition.

## Change rule

Changes to the G16-EMU.2 runtime must preserve:
- G16-EMU.1 source admission;
- explicit runtime approval;
- no automatic ROM or BIOS acquisition;
- deterministic/explicit core resolution;
- G13/G14 controller, session and teardown invariants;
- save flush before runtime teardown;
- full Gaming Core certification.

The documentation commit following the certified code commit contains no runtime behavior changes and should itself be validated by the same Gaming Core workflow.
