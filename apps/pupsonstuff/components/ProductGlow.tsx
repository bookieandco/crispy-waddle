"use client";

import type { CSSProperties } from "react";
import type { SilhouetteId } from "@/lib/silhouettes";
import { silhouetteClipPath } from "@/lib/silhouettes";

interface Props {
  hovered: boolean;
  lifeDelay: number | null;
  lifeCycleSeconds: number;
  silhouette: SilhouetteId;
}

/**
 * The highlight stays INSIDE the photographed product silhouette.
 * No expanding rings, blur halos or re-randomized overlapping flashes.
 * Hover/keyboard focus gives an immediate, gentle static brightening.
 */
export default function ProductGlow({
  hovered,
  lifeDelay,
  lifeCycleSeconds,
  silhouette,
}: Props) {
  return (
    <div
      aria-hidden="true"
      className="pupson-product-glow pointer-events-none absolute inset-0"
      data-hovered={hovered ? "true" : "false"}
      data-ambient={lifeDelay === null ? "false" : "true"}
      style={{
        clipPath: silhouetteClipPath(silhouette),
        "--pupson-glow-cycle": `${lifeCycleSeconds}s`,
        "--pupson-glow-delay": `-${lifeDelay ?? 0}s`,
      } as CSSProperties}
    />
  );
}
