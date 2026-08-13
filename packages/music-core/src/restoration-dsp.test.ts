import { describe, expect, it } from "vitest";
import { applyCase001DeHarshening, applyGain, applyPeakingEq } from "./restoration-dsp";

describe("restoration DSP", () => {
  it("does not mutate the input during gain staging", () => {
    const input = new Float32Array([0.5, -0.5]);
    const result = applyGain(input, -1);
    expect(Array.from(input)).toEqual([0.5, -0.5]);
    // -1dB linear gain on 0.5 is 0.5 * 10^(-1/20) ≈ 0.4456, not 0.4467.
    expect(result.samples[0]).toBeCloseTo(0.4456, 3);
  });

  it("runs a channel-independent peaking EQ", () => {
    const input = new Float32Array(4410);
    input[0] = 1;
    const result = applyPeakingEq(input, 2, {
      sampleRateHz: 44100,
      frequencyHz: 7800,
      q: 1.2,
      gainDb: -1.5,
    });
    expect(result.samples.length).toBe(input.length);
    expect(result.samples.every(Number.isFinite)).toBe(true);
  });

  it("provides the Case #001 de-harshening stage explicitly", () => {
    const input = new Float32Array([0.25, -0.25, 0.1, -0.1]);
    const result = applyCase001DeHarshening(input, 2, 44100);
    expect(result.samples).not.toBe(input);
    expect(result.samples.length).toBe(input.length);
  });
});
