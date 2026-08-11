export interface DspResult {
  samples: Float32Array;
  peakBefore: number;
  peakAfter: number;
  gainReductionDb: number;
}

export interface PeakingEqParameters {
  sampleRateHz: number;
  frequencyHz: number;
  q: number;
  gainDb: number;
}

/**
 * Non-destructive safety gain. The source buffer is never mutated.
 */
export function applyGain(samples: Float32Array, gainDb: number): DspResult {
  const gain = Math.pow(10, gainDb / 20);
  const output = new Float32Array(samples.length);
  let peakBefore = 0;
  let peakAfter = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const input = Number.isFinite(samples[i]) ? samples[i] : 0;
    peakBefore = Math.max(peakBefore, Math.abs(input));
    const value = input * gain;
    output[i] = Math.max(-1, Math.min(1, value));
    peakAfter = Math.max(peakAfter, Math.abs(output[i]));
  }
  return {
    samples: output,
    peakBefore,
    peakAfter,
    gainReductionDb: 20 * Math.log10(Math.max(peakBefore, Number.EPSILON) / Math.max(peakAfter, Number.EPSILON)),
  };
}

/**
 * RBJ cookbook peaking EQ. Samples may be mono or interleaved multi-channel;
 * `channels` determines the independent filter state for each channel.
 */
export function applyPeakingEq(
  samples: Float32Array,
  channels: number,
  params: PeakingEqParameters,
): DspResult {
  if (!Number.isInteger(channels) || channels < 1) throw new Error("channels must be >= 1");
  if (params.sampleRateHz <= 0) throw new Error("sampleRateHz must be > 0");
  if (params.frequencyHz <= 0 || params.frequencyHz >= params.sampleRateHz / 2) {
    throw new Error("frequencyHz must be below Nyquist");
  }
  if (params.q <= 0) throw new Error("q must be > 0");

  const A = Math.pow(10, params.gainDb / 40);
  const omega = 2 * Math.PI * params.frequencyHz / params.sampleRateHz;
  const alpha = Math.sin(omega) / (2 * params.q);
  const cos = Math.cos(omega);
  const beta = -2 * cos;

  const b0 = 1 + alpha * A;
  const b1 = beta;
  const b2 = 1 - alpha * A;
  const a0 = 1 + alpha / A;
  const a1 = beta;
  const a2 = 1 - alpha / A;

  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;

  const x1 = new Float64Array(channels);
  const x2 = new Float64Array(channels);
  const y1 = new Float64Array(channels);
  const y2 = new Float64Array(channels);
  const output = new Float32Array(samples.length);

  let peakBefore = 0;
  let peakAfter = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const channel = i % channels;
    const x0 = Number.isFinite(samples[i]) ? samples[i] : 0;
    const y0 = nb0 * x0 + nb1 * x1[channel] + nb2 * x2[channel] - na1 * y1[channel] - na2 * y2[channel];
    output[i] = Math.max(-1, Math.min(1, y0));
    x2[channel] = x1[channel];
    x1[channel] = x0;
    y2[channel] = y1[channel];
    y1[channel] = output[i];
    peakBefore = Math.max(peakBefore, Math.abs(x0));
    peakAfter = Math.max(peakAfter, Math.abs(output[i]));
  }

  return {
    samples: output,
    peakBefore,
    peakAfter,
    gainReductionDb: 20 * Math.log10(Math.max(peakBefore, Number.EPSILON) / Math.max(peakAfter, Number.EPSILON)),
  };
}

/**
 * Case #001 starting point for the previously observed 6–11 kHz harshness.
 * This is an explicit operation, not an automatic analyzer decision.
 */
export function applyCase001DeHarshening(
  samples: Float32Array,
  channels: number,
  sampleRateHz: number,
): DspResult {
  return applyPeakingEq(samples, channels, {
    sampleRateHz,
    frequencyHz: 7800,
    q: 1.2,
    gainDb: -1.5,
  });
}
