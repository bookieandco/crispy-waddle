import * as THREE from 'three';
import type { Product3DConfig } from './types';

/** Apply a storefront color to a CLONED material; never mutate useGLTF cache.
 * The hoodie carries a dark baked base-color texture. Ordinary white
 * multiplication leaves it muddy gray, so light apparel gets a calibrated
 * high diffuse factor while preserving the existing fabric and normal maps.
 * Actual fabric color still requires photo review; this is display only. */
export function toneProductMaterial(
  material: THREE.MeshStandardMaterial,
  config: Product3DConfig,
  hex: string,
): void {
  if (config.id === 'hoodie') {
    const target = new THREE.Color(hex);
    const luminance = target.r * 0.2126 + target.g * 0.7152 + target.b * 0.0722;
    if (luminance >= 0.35) {
      material.color.setRGB(target.r * 2.15, target.g * 2.15, target.b * 2.15);
      material.emissive.setRGB(0.07, 0.07, 0.07);
    } else {
      material.color.setRGB(Math.max(0.22, target.r), Math.max(0.22, target.g), Math.max(0.22, target.b));
      material.emissive.setRGB(0.014, 0.014, 0.014);
    }
    material.roughness = Math.max(0.85, material.roughness);
  } else if (config.supportsColorChange) {
    material.color.set(hex);
    material.roughness = Math.max(0.82, material.roughness);
  }
  material.needsUpdate = true;
}
