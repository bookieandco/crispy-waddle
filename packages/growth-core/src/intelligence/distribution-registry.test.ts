import { describe, expect, it } from 'vitest';
import { defaultDistributionSurfaces, getDistributionSurface } from './distribution-registry.js';

describe('distribution registry', () => {
  it('covers core discovery and distribution surfaces', () => {
    const surfaces = defaultDistributionSurfaces();
    expect(surfaces.length).toBeGreaterThanOrEqual(10);
    expect(surfaces.some((s) => s.id === 'social:tiktok')).toBe(true);
    expect(surfaces.some((s) => s.id === 'search:google')).toBe(true);
    expect(surfaces.some((s) => s.id === 'community:reddit')).toBe(true);
    expect(surfaces.some((s) => s.id === 'creator:network')).toBe(true);
    expect(surfaces.some((s) => s.id === 'paid:multi')).toBe(true);
  });

  it('returns a typed surface by stable id', () => {
    const surface = getDistributionSurface('social:instagram');
    expect(surface?.enabled).toBe(true);
    expect(surface?.capabilities).toContain('publish');
  });

  it('returns undefined for unknown surfaces', () => {
    expect(getDistributionSurface('unknown:surface')).toBeUndefined();
  });
});
