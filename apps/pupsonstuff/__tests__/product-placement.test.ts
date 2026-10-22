import { describe, it, expect } from 'vitest';
import { placementBounds } from '../lib/product3d/placement';

describe('aspect-aware magnetic placement', () => {
  it.each([0, 30, 90, 135])(
    'contains wide artwork on a portrait area at %s degrees',
    (rotation) => {
      const bounds = placementBounds({ scale: 2, rotation }, 3, 0.75);
      expect(bounds.minX).toBeGreaterThanOrEqual(0);
      expect(bounds.minY).toBeGreaterThanOrEqual(0);
      expect(bounds.minX).toBeLessThanOrEqual(0.500001);
      expect(bounds.minY).toBeLessThanOrEqual(0.500001);
      expect((bounds.width * 0.75) / bounds.height).toBeCloseTo(3);
    }
  );
  it('preserves portrait artwork on a mug wrap', () => {
    const bounds = placementBounds({ scale: 1 }, 0.5, 2.6);
    expect((bounds.width * 2.6) / bounds.height).toBeCloseTo(0.5);
    expect(bounds.height).toBeCloseTo(0.5);
  });
  it('normalizes invalid gestures', () => {
    const bounds = placementBounds({ scale: Infinity, rotation: NaN }, 0, NaN);
    expect(bounds.width).toBe(0.5);
    expect(bounds.transform.rotation).toBe(0);
  });
});
