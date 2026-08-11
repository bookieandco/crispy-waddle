# Jhadina Native DSP

This directory defines the shared native audio-processing boundary for studio and mobile hosts.

## Contract

`include/jhadina_dsp.h` exposes a small C ABI so VST3/AU/AAX wrappers and mobile native bridges can share one DSP kernel.

The `process` callback is designed to be realtime-safe after engine creation:

- no allocation
- no locks
- no filesystem access
- no network access
- bounded frame count

The current C++ implementation is intentionally a transparent pass-through scaffold. It establishes the ABI and buffer/metrics contract before production EQ, dynamics, saturation, and true-peak limiting are moved into the kernel.

Jhadina's TypeScript layer remains responsible for evidence, plans, policy, approvals, QC, and version provenance; native code is responsible only for deterministic audio processing.
