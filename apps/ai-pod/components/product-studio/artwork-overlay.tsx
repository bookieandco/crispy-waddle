"use client";

import { useTexture } from "@react-three/drei";
import { Decal } from "@react-three/drei";
import * as THREE from "three";

type ArtworkOverlayProps = {
  assetUrl: string;
  position?: [number, number, number];
  scale?: number;
  rotation?: [number, number, number];
};

/**
 * Renderer primitive for a generated artwork decal. Product-specific surface
 * transforms remain outside this component so the same primitive can be used
 * for shirts, mugs, posters, hats, and future product models.
 */
export function ArtworkOverlay({
  assetUrl,
  position = [0, 0, 0.02],
  scale = 1,
  rotation = [0, 0, 0],
}: ArtworkOverlayProps) {
  const texture = useTexture(assetUrl);
  texture.colorSpace = THREE.SRGBColorSpace;

  return (
    <Decal
      position={position}
      rotation={rotation}
      scale={scale}
      map={texture}
      transparent
    />
  );
}
