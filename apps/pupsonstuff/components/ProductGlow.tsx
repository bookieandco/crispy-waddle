"use client";

import { motion } from "framer-motion";
import { RING_COUNT, RING_STAGGER_SECONDS } from "@/lib/lifeGlow";
import {
  SilhouetteId,
  silhouetteClipPath,
  silhouettePolygonPoints,
} from "@/lib/silhouettes";

interface Props {
  /** true while the pointer is actually over this hotspot */
  hovered: boolean;
  /**
   * This hotspot's position in the guided-tour sequence, in seconds.
   * `null` disables BOTH ambient layers (breathing + ping) — non-product
   * hotspots, or while the panel is open.
   */
  lifeDelay: number | null;
  lifeCycleSeconds: number;
  silhouette: SilhouetteId;
}

/**
 * Three layers, all shaped to the product's real silhouette
 * (lib/silhouettes.ts) rather than a circle or box:
 *
 * 1. The mask — a backdrop-filter clipped to the silhouette. This is the
 *    "actual product glowing" fix: it brightens the boutique photo's own
 *    pixels behind the shape, nothing is painted on top. Used for both the
 *    hover brighten and the guided-tour's brief flash (life-ping-core) —
 *    same element, since a product is never doing both at once.
 * 2. The breathing aura — always on, all products at once, independent of
 *    the guided-tour sequence. A warm, blurred, screen-blended shape
 *    (mix-blend-mode: screen only ever lightens, never adds a flat colored
 *    patch) that bleeds a few px past the silhouette's own edge — the
 *    "glow radius" from the spec — at low, slowly breathing opacity.
 * 3. The guided-tour rings — start AT the silhouette's own outline
 *    (scale 1) and expand outward from there, so it reads as the product's
 *    edge rippling, not a glow spawned from empty space.
 */
export default function ProductGlow({
  hovered,
  lifeDelay,
  lifeCycleSeconds,
  silhouette,
}: Props) {
  const clipPath = silhouetteClipPath(silhouette);
  const polygonPoints = silhouettePolygonPoints(silhouette);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {/* Layer 2: always-on breathing aura, behind everything else */}
      {lifeDelay !== null && (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 overflow-visible"
          style={{ filter: "blur(6px)", mixBlendMode: "screen" }}
        >
          <polygon
            points={polygonPoints}
            fill="rgba(255, 196, 80, 0.9)"
            className="life-breathe"
            style={{ animationDuration: `1.25s` }}
          />
        </svg>
      )}

      {/* Layer 1: the real brightening mask (hover OR guided-tour flash) */}
      <motion.div
        className="absolute inset-0"
        style={{ clipPath }}
        initial={false}
        animate={{
          backdropFilter: hovered
            ? "brightness(1.6) saturate(1.45) contrast(1.1)"
            : "brightness(1) saturate(1) contrast(1)",
          WebkitBackdropFilter: hovered
            ? "brightness(1.6) saturate(1.45) contrast(1.1)"
            : "brightness(1) saturate(1) contrast(1)",
        }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      />
      {!hovered && lifeDelay !== null && (
        <div
          className="life-ping-core absolute inset-0"
          style={{
            clipPath,
            animationDuration: `${lifeCycleSeconds}s`,
            animationDelay: `-${lifeDelay}s`,
          }}
        />
      )}

      {/* Layer 3: guided-tour rings, starting at the silhouette itself */}
      {!hovered && lifeDelay !== null && (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 overflow-visible"
        >
          {Array.from({ length: RING_COUNT }).map((_, i) => (
            <polygon
              key={i}
              points={polygonPoints}
              fill="none"
              stroke="rgba(255, 206, 110, 0.9)"
              strokeWidth={1.2}
              vectorEffect="non-scaling-stroke"
              className="life-ping-ring"
              style={{
                transformOrigin: "50% 50%",
                animationDuration: `${lifeCycleSeconds}s`,
                animationDelay: `-${lifeDelay + i * RING_STAGGER_SECONDS}s`,
              }}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
