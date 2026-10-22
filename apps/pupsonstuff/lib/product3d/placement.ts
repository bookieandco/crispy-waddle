import * as THREE from 'three';
import { normalizeArtworkTransform, type ArtworkTransform } from '@/types/creative';
import type { PrintArea } from './types';

/** Clamp an artwork CENTER into a normalized print zone, accounting for
 * its effective half-extents. Used by both Sharp's final print compositor
 * and the Three.js display projector. No shifting outside the print zone. */
export function clampArtworkCenter(
  transform: Partial<ArtworkTransform> | undefined,
  halfWidth: number,
  halfHeight: number,
): ArtworkTransform {
  const normalized = normalizeArtworkTransform(transform);
  const clampAxis = (center: number, half: number) => {
    const bound = Math.min(0.5, Math.max(0, Number.isFinite(half) ? half : 0.5));
    return Math.max(bound, Math.min(1 - bound, center));
  };
  return {
    ...normalized,
    x: clampAxis(normalized.x, halfWidth),
    y: clampAxis(normalized.y, halfHeight),
  };
}

/** An approximate projector using the SAME normalized placement, scaling
 * and clockwise rotation convention as ArtworkEditor and buildPrintMaster.
 * Projection is a visual preview, NOT a verified mug/bottle UV wrap.
 *
 * PrintArea.position is in raw GLB mesh space. The GLB viewer centers the
 * mesh in the outer group, so geometry and projector are both shifted by
 * the same mesh.position. Do not subtract the geometric center twice.
 *
 * Rotations: DOM and Sharp +degrees are clockwise; positive Three Z is
 * counter-clockwise from the +Z camera, hence the negative sign.
 */
export function getDecalPlacement(
  area: PrintArea,
  input: Partial<ArtworkTransform> | undefined,
): { position: [number, number, number]; rotation: [number, number, number]; scale: number } {
  const t = normalizeArtworkTransform(input);
  const footprint = area.scale * 0.5 * t.scale;
  const radians = (t.rotation * Math.PI) / 180;
  const rotatedHalf = 0.25 * t.scale * (Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians)));
  const center = clampArtworkCenter(t, rotatedHalf, rotatedHalf);

  // Area orientation determines horizontal and vertical on the raw mesh.
  // In particular, the pillow's front plane lies in X/Z, NOT X/Y.
  const surface = new THREE.Quaternion().setFromEuler(new THREE.Euler(...area.rotation, 'XYZ'));
  const u = new THREE.Vector3(1, 0, 0).applyQuaternion(surface);
  const v = new THREE.Vector3(0, 1, 0).applyQuaternion(surface);
  const point = new THREE.Vector3(...area.position)
    .addScaledVector(u, (center.x - 0.5) * area.scale)
    .addScaledVector(v, -(center.y - 0.5) * area.scale);
  const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -radians);
  const euler = new THREE.Euler().setFromQuaternion(surface.multiply(roll), 'XYZ');
  return {
    position: [point.x, point.y, point.z],
    rotation: [euler.x, euler.y, euler.z],
    scale: footprint,
  };
}
