import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Repair a private runtime copy; preserve approved source GLB bytes. */
export function prepareProductGeometry(source: THREE.Mesh, productId: string, scale = 1) {
  source.updateWorldMatrix(true, false);
  let geometry = source.geometry.clone();
  geometry.applyMatrix4(source.matrixWorld);
  geometry.scale(scale, scale, scale);
  if (productId === 'bottle') {
    const index = geometry.index;
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const second = index.getX(i + 1);
        index.setX(i + 1, index.getX(i + 2));
        index.setX(i + 2, second);
      }
    } else {
      const count = geometry.attributes.position.count;
      geometry.setIndex(
        Array.from({ length: count }, (_, i) => (i % 3 === 1 ? i + 1 : i % 3 === 2 ? i - 1 : i))
      );
    }
    geometry.deleteAttribute('normal');
    const welded = mergeVertices(geometry);
    geometry.dispose();
    geometry = welded;
    geometry.computeVertexNormals();
  }
  return geometry;
}
