import { describe, expect, it } from 'vitest';
import { fitProductCamera, modelBoundingRadius } from '../lib/product3d/framing';

describe('PupsonStuff product 3D framing', () => {
  it('rejects malformed geometry instead of moving the camera to NaN', () => {
    expect(modelBoundingRadius([0, 0, 0])).toBeNull();
    expect(modelBoundingRadius([1, Number.NaN, 1])).toBeNull();
    expect(modelBoundingRadius([-1, 2, 3])).toBeNull();
    expect(modelBoundingRadius([1, 1, 1], 0)).toBeNull();
    expect(fitProductCamera(null)).toBeNull();
    expect(fitProductCamera(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('respects original mesh units without assuming every GLB is meters', () => {
    const small = modelBoundingRadius([0.08, 0.1, 0.08]);
    const large = modelBoundingRadius([80, 100, 80]);
    expect(small).not.toBeNull();
    expect(large).toBeCloseTo(small! * 1000);
    const smallFrame = fitProductCamera(small, { fov: 30 });
    const largeFrame = fitProductCamera(large, { fov: 30 });
    expect(largeFrame!.distance).toBeCloseTo(smallFrame!.distance * 1000);
  });

  it('increases the distance on tall/narrow portrait canvases', () => {
    const radius = modelBoundingRadius([0.75, 0.9, 0.2])!;
    const square = fitProductCamera(radius, { aspect: 1, fov: 30 })!;
    const portrait = fitProductCamera(radius, { aspect: 0.5, fov: 30 })!;
    expect(portrait.distance).toBeGreaterThan(square.distance);
    expect(square.minDistance).toBeLessThan(square.distance);
    expect(square.maxDistance).toBeGreaterThan(square.distance);
  });

  it('extends configured orbit limits when the GLB would otherwise be clipped', () => {
    const frame = fitProductCamera(70, {
      fov: 30, minDistance: 1.6, maxDistance: 3.2,
    })!;
    expect(frame.distance).toBeGreaterThan(3.2);
    expect(frame.maxDistance).toBeGreaterThan(frame.distance);
    expect(frame.minDistance).toBeLessThan(frame.distance);
  });

  it('honors corrective model scale without touching print-area coordinates', () => {
    const raw = modelBoundingRadius([0.5, 1, 0.2])!;
    expect(modelBoundingRadius([0.5, 1, 0.2], 2)).toBeCloseTo(raw * 2);
    expect(modelBoundingRadius([0.5, 1, 0.2], -2)).toBeCloseTo(raw * 2);
  });

  it('survives invalid camera inputs with finite safe limits', () => {
    const frame = fitProductCamera(1, {
      fov: Number.NaN, aspect: Number.NaN, padding: Number.POSITIVE_INFINITY,
    })!;
    expect(Object.values(frame).every(Number.isFinite)).toBe(true);
    expect(frame.minDistance).toBeLessThan(frame.distance);
    expect(frame.maxDistance).toBeGreaterThan(frame.distance);
  });
});
