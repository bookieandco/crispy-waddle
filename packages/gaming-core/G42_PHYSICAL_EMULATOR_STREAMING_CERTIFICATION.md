# G42 — Physical Emulator & Online Streaming Certification

## Software phase status

**G32-G42 certification framework: COMPLETE**

The emulator track retains content/firmware provenance, measured compatibility receipts, save round-trip health, Libretro/WASM, EmulatorJS/browser and governed native emulator paths.

The online streaming track now has a canonical policy surface for:
- Sunshine/Moonlight
- PlayStation Remote Play
- Xbox home streaming
- Xbox cloud streaming
- Steam remote streaming

Streaming invariants:
- credentials isolated from the LLM;
- authenticated managed sessions;
- video buffering may never delay the certified input path;
- network degradation reduces video quality before controller responsiveness;
- excessive input latency blocks latency-sensitive play;
- reconnect must preserve G13 no-uncertain-replay semantics.

## G42 physical certification

G42 consumes actual emulator compatibility receipts and streaming network samples. A successful physical certification requires:
- at least one measured physical emulator receipt;
- at least one physical streaming sample;
- artifact references for every evidence item;
- >=240 minute soak;
- >=20 session cycles;
- zero orphaned resources;
- zero input-integrity errors;
- zero save corruption.

Required route matrix includes local/browser/native emulation plus Sunshine LAN/internet, PlayStation Remote Play, Xbox home and Xbox cloud.

## Current physical status

**AUDIT/REPAIR — EVIDENCE REQUIRED**

This environment cannot physically observe the user's emulator host, controller, display, Sunshine host/client, PlayStation, Xbox, ISP path, Wi-Fi, Bluetooth, or display photons. CI results therefore cannot be used as physical G42 receipts.

The software/certification implementation is complete. The physical certification marker remains open until real hardware/network evidence is ingested.
