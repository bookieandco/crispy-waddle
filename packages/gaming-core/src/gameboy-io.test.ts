import { describe, expect, it } from 'vitest';
import { validateGameBoyAudio, validateGameBoyFrame } from './gameboy-io.js';

describe('Game Boy IO contracts', () => {
  it('accepts the native 160x144 frame size', () => {
    expect(() => validateGameBoyFrame({ width: 160, height: 144, pixels: new Uint8Array(160 * 144) })).not.toThrow();
  });

  it('rejects invalid frame dimensions', () => {
    expect(() => validateGameBoyFrame({ width: 320, height: 288, pixels: new Uint8Array(1) })).toThrow();
  });

  it('rejects invalid audio configuration', () => {
    expect(() => validateGameBoyAudio({ sampleRate: 0, channels: 2, samples: new Float32Array(0) })).toThrow();
  });
});
