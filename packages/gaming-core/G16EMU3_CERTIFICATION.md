# G16-EMU.3 Browser/EmulatorJS Runtime Certification

Status: COMPLETE FOR G16-EMU.3 CODE SCOPE

Certified code commit: `cef3f54d1cfab2a3047de8b2e5b8a716fa296896`
Gaming Core Certification run: `35535359187` (run #140)
Certification job: `106143295941`
Result: SUCCESS

Observed results:
- Test files: **59 passed / 59**
- Tests: **142 passed / 142**
- Turbo tasks: **3 successful / 3**
- Frozen pnpm workspace install: **success**
- Compared with `jhadina-gaming-g16emu2`: **3 commits ahead, 0 behind**

## Scope

G16-EMU.3 adds a governed browser emulator runtime using the EmulatorJS architecture while preserving the G16-EMU.1 source-admission boundary and G14 managed-session lifecycle.

Runtime path:

`GameLibraryEntry -> EmulatorJsCoreRegistry -> approved EmulatorJS source -> self-hosted asset manifest -> approved content provider -> browser capability gate -> EmulatorJS host -> UnifiedGamingSession`

## Upstream-derived integration constraints

The current EmulatorJS source exposes:
- explicit system/core selection;
- browser gamepad integration;
- IndexedDB-backed save persistence;
- save/save-state lifecycle hooks;
- thread requirements for selected cores;
- WebGL2 requirements for selected cores;
- an upstream CDN fallback when expected local assets are missing.

Jhadina deliberately does not inherit the CDN fallback behavior.

## Browser-runtime invariants

- EmulatorJS must independently pass the G16-EMU.1 candidate audit.
- Explicit user approval is required before this runtime becomes eligible.
- Emulator assets must be self-hosted and versioned.
- The selected core must appear in the pinned local asset manifest.
- The manifest must assert that CDN fallback is disabled.
- Launch requests set `disableExternalNetwork: true`.
- Launch requests set `disableCdnFallback: true`.
- ROM/game content must already resolve from an approved app/device/memory provider.
- Jhadina does not download ROMs.
- Required BIOS/system ROMs must already resolve through the approved firmware provider.
- Jhadina does not download BIOS/system ROMs.
- Ambiguous disc/container extensions are rejected unless metadata identifies the target system.
- Browser gamepad capability is required.
- Threaded cores require WASM thread support plus cross-origin isolation.
- WebGL2-only cores require WebGL2.
- IndexedDB availability controls persistent browser-save support.
- Browser saves are flushed before the managed emulator session stops.
- Runtime teardown remains owned by `UnifiedGamingSession`.

## Current pinned browser systems

The initial registry covers browser profiles for:
- NES
- Game Boy / Game Boy Color
- Game Boy Advance
- SNES
- Nintendo 64
- PlayStation
- Nintendo DS
- Sega Genesis / Mega Drive
- Sega Master System
- Sega Game Gear
- Sega CD
- Atari 2600
- Atari 5200
- Atari 7800
- Atari Lynx
- Neo Geo Pocket
- PC Engine
- WonderSwan
- ColecoVision
- PSP
- DOS
- Nintendo 3DS

The browser registry is intentionally separate from the broader G16-EMU.2 Libretro/WASM registry because browser capability and upstream-core requirements differ.

## Change rule

Future browser-emulation changes must preserve:
- no automatic ROM/BIOS acquisition;
- self-hosted pinned runtime assets;
- disabled CDN fallback;
- explicit browser capability gating;
- G16-EMU.1 source admission;
- G14 session/resource ownership;
- save flush before teardown;
- Gaming Core certification.

The documentation commit following the certified code commit contains no runtime behavior changes and should itself pass the same certification workflow.
