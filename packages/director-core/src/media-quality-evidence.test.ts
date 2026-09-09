import { describe, expect, it } from 'vitest';
import { assessImageQuality, assessVideoQuality } from './media-quality-evidence';

describe('media quality evidence', () => {
  it('warns when image clipping exceeds the review threshold', () => {
    expect(assessImageQuality({ width: 3840, height: 2160, hdr: true, clippingFraction: 0.06 })).toBe('warn');
  });

  it('warns when video contains dropped frames', () => {
    expect(assessVideoQuality({ width: 3840, height: 2160, droppedFrames: 1 })).toBe('warn');
  });

  it('fails invalid dimensions', () => {
    expect(assessImageQuality({ width: 0, height: 2160 })).toBe('fail');
    expect(assessVideoQuality({ width: 3840, height: 0 })).toBe('fail');
  });
});
