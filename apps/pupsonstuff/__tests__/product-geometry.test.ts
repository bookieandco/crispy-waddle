import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { prepareProductGeometry } from '../lib/product3d/geometry';
import { product3DModels } from '../config/product3dModels';
async function load(name: string) {
  const bytes = readFileSync(new URL(`../public/models/${name}.glb`, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ''
  );
  return gltf.scene.getObjectByName(product3DModels[name].meshName!) as THREE.Mesh;
}
describe('real product geometry corrections', () => {
  it('corrects bottle normals without mutating source geometry', async () => {
    const source = await load('bottle');
    const original = source.geometry.attributes.normal.array.slice();
    const result = prepareProductGeometry(source, 'bottle');
    let dot = 0,
      count = 0;
    const positions = result.attributes.position,
      normals = result.attributes.normal;
    for (let i = 0; i < positions.count; i++) {
      if (positions.getZ(i) > 0.03 && Math.abs(positions.getY(i)) < 0.1) {
        dot += normals.getZ(i);
        count++;
      }
    }
    expect(count).toBeGreaterThan(0);
    expect(dot / count).toBeGreaterThan(0.5);
    expect(source.geometry.attributes.normal.array).toEqual(original);
    result.dispose();
  });
  it('applies pillow units once and presents its broad face upright', async () => {
    const source = await load('pillow'),
      config = product3DModels.pillow;
    const result = prepareProductGeometry(source, 'pillow', config.modelScale);
    result.rotateX(config.modelRotation![0]);
    result.computeBoundingBox();
    const size = result.boundingBox!.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(0.8);
    expect(size.y).toBeGreaterThan(0.8);
    expect(size.z).toBeLessThan(0.4);
    result.dispose();
  });
});
