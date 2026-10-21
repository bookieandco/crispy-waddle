import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { product3DModels, hotspot3DModels } from '../config/product3dModels';
import { clampArtworkCenter, getDecalPlacement } from '../lib/product3d/placement';
import { toneProductMaterial } from '../lib/product3d/material';

describe('3D product inventory and local-coordinate artwork mapping', () => {
  it('keeps each approved 3D product mapped to a real GLB and front print area', () => {
    for (const id of ['shirt', 'hoodie', 'mug', 'pillow', 'bottle', 'tote']) {
      const m = product3DModels[id];
      expect(m.glbPath).toMatch(/^\/models\/.+\.glb$/);
      expect(m.meshName).toBeTruthy();
      expect(m.materialName).toBeTruthy();
      expect(m.printAreas.some(area => area.name === 'front')).toBe(true);
      expect(m.camera.position[2]).toBeGreaterThan(0);
    }
    expect(product3DModels.canvas.primitive).toBe('canvas');
    for (const [hotspot, mapping] of Object.entries(hotspot3DModels)) {
      expect(product3DModels[mapping.modelId], hotspot).toBeDefined();
      expect(product3DModels[mapping.modelId].printAreas.some(a => a.name === mapping.printArea), hotspot).toBe(true);
    }
  });

  it('uses half the print-zone width at scale=1, same as the Sharp master', () => {
    for (const config of Object.values(product3DModels)) {
      const area = config.printAreas[0];
      const p = getDecalPlacement(area, { x: 0.5, y: 0.5, scale: 1, rotation: 0 });
      expect(p.scale).toBeCloseTo(area.scale / 2);
      expect(p.position).toEqual(area.position);
      expect(p.rotation.every(Number.isFinite)).toBe(true);
    }
  });

  it('moves along local print-plane axes, including pillow X/Z', () => {
    const upright = product3DModels.hoodie.printAreas[0];
    const moved = getDecalPlacement(upright, { x: 0.65, y: 0.35, scale: 0.5, rotation: 0 });
    expect(moved.position[0]).toBeGreaterThan(upright.position[0]);
    expect(moved.position[1]).toBeGreaterThan(upright.position[1]);
    const pillow = product3DModels.pillow.printAreas[0];
    const offset = getDecalPlacement(pillow, { x: 0.65, y: 0.35, scale: 0.5, rotation: 0 });
    expect(offset.position[0]).toBeGreaterThan(pillow.position[0]);
    expect(offset.position[2]).toBeLessThan(pillow.position[2]);
    expect(offset.position[1]).toBeCloseTo(pillow.position[1]);
  });

  it('converts clockwise positive editor rotation to Three negative Z', () => {
    const area = product3DModels.shirt.printAreas[0];
    const v = getDecalPlacement(area, { x: 0.5, y: 0.5, scale: 1, rotation: 45 });
    expect(v.rotation[2]).toBeCloseTo(-Math.PI / 4);
    expect(getDecalPlacement(area, {rotation: Number.NaN}).rotation[2]).toBeCloseTo(0);
  });

  it('clamps the center safely, refusing NaN and oversized edge placement', () => {
    const c = clampArtworkCenter({ x: 0, y: 1, scale: 2 }, 0.3, 0.2);
    expect(c.x).toBe(0.3);
    expect(c.y).toBe(0.8);
    const area = product3DModels.shirt.printAreas[0];
    const edge = getDecalPlacement(area, {x: 0, y: 0, scale: 2, rotation: 45});
    expect(edge.position[0]).toBeCloseTo(area.position[0]);
    expect(edge.position[1]).toBeCloseTo(area.position[1]);
    expect(edge.position.every(Number.isFinite)).toBe(true);
  });
});

describe('independent fabric material tuning', () => {
  it('makes white hoodie brighter than the baked gray without mutating the source', () => {
    const source = new THREE.MeshStandardMaterial({color:'#9b9b9b'});
    const white = source.clone();
    const black = source.clone();
    toneProductMaterial(white, product3DModels.hoodie, '#f4f4f4');
    toneProductMaterial(black, product3DModels.hoodie, '#111111');
    expect(white.color.r).toBeGreaterThan(1);
    expect(black.color.r).toBeLessThan(0.1);
    expect(source.color.r).toBeLessThan(0.5);
    white.dispose();
    black.dispose();
    source.dispose();
  });
});
