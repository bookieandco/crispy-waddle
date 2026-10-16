import { describe, it, expect } from 'vitest';
import {
  BOUTIQUE_ASPECT_RATIO, BOUTIQUE_IMAGE_WIDTH, BOUTIQUE_IMAGE_HEIGHT, boutiquePanLeft,
} from '../lib/boutique-viewport';
import { hotspots } from '../data/hotspots';
import {
  GLOW_DURATION_SECONDS, GLOW_STEP_SECONDS, LIFE_CYCLE_SECONDS, lifeDelayById, LIFE_SEQUENCE,
} from '../lib/lifeGlow';

describe('photo + hotspots responsive geometry', () => {
  it('has one canonical photo-space aspect ratio', () => {
    expect(BOUTIQUE_IMAGE_WIDTH).toBe(1568);
    expect(BOUTIQUE_IMAGE_HEIGHT).toBe(1003);
    expect(BOUTIQUE_ASPECT_RATIO).toBeCloseTo(1.5633, 3);
  });

  it('centers department navigation on portrait iPhone and clamps edge pans', () => {
    const height = 844;
    const stageWidth = height * BOUTIQUE_ASPECT_RATIO;
    const viewportWidth = 390;
    expect(stageWidth).toBeGreaterThan(viewportWidth);
    expect(boutiquePanLeft(stageWidth, viewportWidth, 50))
      .toBeCloseTo((stageWidth - viewportWidth) / 2, 6);
    expect(boutiquePanLeft(stageWidth, viewportWidth, 0)).toBe(0);
    expect(boutiquePanLeft(stageWidth, viewportWidth, 100))
      .toBeCloseTo(stageWidth - viewportWidth, 6);
  });

  it('does not pan when the entire photograph fits the viewport', () => {
    expect(boutiquePanLeft(390, 390, 75)).toBe(0);
    expect(boutiquePanLeft(0, 390, 75)).toBe(0);
    expect(boutiquePanLeft(1000, 390, Number.NaN)).toBe(0);
  });

  it('keeps every original product in the photograph coordinate system', () => {
    for (const h of hotspots) {
      expect(h.x).toBeGreaterThanOrEqual(0);
      expect(h.y).toBeGreaterThanOrEqual(0);
      expect(h.x + h.width).toBeLessThanOrEqual(100);
      expect(h.y + h.height).toBeLessThanOrEqual(100);
    }
  });
});

describe('product-attached calm highlights', () => {
  it('prevents simultaneous attention pings and sudden reshuffle', () => {
    expect(GLOW_DURATION_SECONDS).toBeLessThan(GLOW_STEP_SECONDS);
    expect(LIFE_CYCLE_SECONDS).toBe(LIFE_SEQUENCE.length * GLOW_STEP_SECONDS);
    expect(lifeDelayById.size).toBe(LIFE_SEQUENCE.length);
    expect(new Set([...lifeDelayById.values()]).size).toBe(LIFE_SEQUENCE.length);
    expect(lifeDelayById.has('checkout')).toBe(false);
    expect([...lifeDelayById.values()]).toEqual(
      LIFE_SEQUENCE.map((_, index) => index * GLOW_STEP_SECONDS)
    );
  });
});
