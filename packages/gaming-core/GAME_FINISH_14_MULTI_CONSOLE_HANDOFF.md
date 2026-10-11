# GAME-FINISH.14 — Expanded emulator review and handoff
Date: 2026-10-10

## Existing operational foundation
Jhadina Game Core is [draft PR #1200](https://github.com/bookieandco/crispy-waddle/pull/1200), branch `game-core-audit-repair`. The Game Boy/Game Boy Color phone browser runtime already vendors the licensed MIT binjgb WebAssembly core and 2048 homebrew. Vercel preview `dpl_8T6Qx22Rxi9W44SP8qo2cebP79EQ` was READY for prior exact head `e17ee2df`. This does **not** establish physical iPhone input/save acceptance.

## Newly audited upstream sources
| System | Pinned source commit | Licensing / commissioning |
| --- | --- | --- |
| Jgenesis (Genesis, SNES, NES, GB, GBA and other systems) | `jsgroth/jgenesis@220421984e710758cb691dcd1dd6a757ae9aca72` | GPLv3; separate Windows/Linux and official browser WASM targets. iPhone WASM build, save and input evidence absent |
| RetroArch multi-core frontend | `libretro/RetroArch@cdc286f851d4f04264b7ef88ca63d8c357409fd5` | GPLv3 frontend; **each libretro core has its own license** and potentially BIOS requirements. iOS native app does not establish direct browser runtimes |
| DuckStation PS1 | `stenzek/duckstation@cd024df237d46faa4c65574b101261b31267e2fd` | Current repository LICENSE CC BY-NC-ND 4.0: commercial and adapted redistribution restricted. Owner-provided PS1/PS2 BIOS required |
| Snes9x SNES | `snes9xgit/snes9x@1bcc369e89f08243e0a462882fb1f3e42e51de3a` | Custom **personal/noncommercial** permission terms, not automatic commercial rights |
| KytyPS5 compatibility | `KytyPS5/KytyPS5@730e1a3cf39d50c787d477e813e0bef92006a063` | GPL-2.0; experimental desktop compatibility, Vulkan 1.3; Windows/Linux principal targets and macOS experimental. No phone/browser PS5 game claim |

## Code delivered
- Six distinct `CONSOLE_EMULATOR_CANDIDATES` entries for five reviewed sources (Jgenesis desktop versus unverified browser-WASM build).
- `evaluateConsoleCandidate` is an **evidence-only admission policy**, not a process launcher. Requires source commit and executable hash, trusted host, game provenance, operator approval; additionally checks browser review, individual Libretro core license, DuckStation owner-provided BIOS and noncommercial/no-derivative limitations, Snes9x commercial permission, and experimental GPU attestation.
- Expanded source registry. KytyPS5 entered PS5 catalog as **metadata-only**, with no automatic launch. Added regression cases for safety gates.
- Gaming page now shows all five candidates and corrects the old false EmulatorJS installation warning; binjgb is the current phone core.

## Release gates, in order
1. Pass exact-head Gaming Core CI, Web Deploy and Launch Gate. Keep PR draft until review.
2. Verify a preview for exact head before giving out a current live play link.
3. Complete real iPhone 2048 touch/controller/save-reload, and one encrypted real-save restore from Google Drive.
4. On an operator-approved Windows/Linux host, independently inventory compatible GPU, reviewed binary, licensed game and lawful BIOS before native launch.
5. Prioritize a **Jgenesis web/WASM source audit** for licensed Sega/SNES homebrew, but do not claim Safari compatibility or install its assets until compiled and tested.
6. RetroArch core inventory/rights individually; Snes9x and DuckStation commercial rights require an affirmative legal permission if used commercially.
7. KytyPS5 remains experimental with no verified games on user hardware.

All five upstreams are **source candidates only**. No unapproved emulator executable, proprietary game, copyrighted firmware, or paid GPU was downloaded or installed.
