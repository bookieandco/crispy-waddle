# G28.12 — Production Acceptance Report

## Status

**COMMISSIONING SOFTWARE COMPLETE — PHYSICAL EVIDENCE REQUIRED**

This report closes implementation of G28.1 through G28.12 without inventing physical-device results.

G28 is designed so software tests can prove the commissioning harness, evidence validation, failure-drill rules, soak rules, and report generator. They cannot truthfully prove that a GameSir X5 Lite, DualSense, PS5, Xbox, Homebase/TV, or network path was physically exercised unless an observed hardware receipt exists.

## Implemented phases

- G28.1 — physical commissioning evidence harness
- G28.2 — GameSir X5 Lite local + PS5 acceptance cases
- G28.3 — DualSense USB, Bluetooth, and PS5 capability cases
- G28.4 — Libretro/WASM, EmulatorJS/browser, native emulator hardware cases
- G28.5 — Homebase -> TV direct-route case
- G28.6 — Sunshine/Moonlight LAN + internet cases
- G28.7 — PlayStation LAN + internet cases
- G28.8 — Xbox home + cloud cases
- G28.9 — 15 destructive physical failure drills
- G28.10 — >=4 hour / >=20 cycle physical soak gate
- G28.11 — device matrix evidence evaluation
- G28.12 — deterministic production acceptance report

## Physical acceptance rule

A G28 case passes only when:
1. `observedByHardware=true`;
2. at least the required number of samples are present;
3. every case-specific requirement is evidenced;
4. every sample reports zero orphaned resources.

Failure drills additionally require:
- zero uncertain-input replay;
- zero orphaned resources;
- zero save corruption;
- successful recovery.

The soak additionally requires:
- physical observation;
- >=240 minutes;
- >=20 session cycles;
- starts == stops;
- zero orphaned resources;
- zero input-integrity errors;
- zero save corruption;
- zero unrecovered crashes.

## Current acceptance result

Until real receipts are ingested, the deterministic report status is:

`evidence-required`

This is intentional. The implementation refuses to transform CI simulation into a claim of physical commissioning.

## Required evidence sources

Physical commissioning should attach artifact references for traces, logs, measurements, or captured device receipts. Each receipt records:
- device identity;
- firmware versions;
- runtime versions;
- T0 physical input;
- Jhadina capture;
- runtime receipt;
- frame render;
- display observation;
- RTT;
- jitter;
- packet loss;
- reconnect count;
- orphan-resource count.

Once every G28 case, destructive drill, and soak receipt is present, the same report generator can deterministically produce `accepted`.
