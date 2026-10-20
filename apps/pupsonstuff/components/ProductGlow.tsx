"use client";

import type { CSSProperties } from "react";

interface Props {
  hovered: boolean;
  lifeDelay: number | null;
  lifeCycleSeconds: number;
}

/**
 * A small, soft-focus brightening avoids artificial polygon contours.
 * Ambient timing is staggered one product at a time, never simultaneous.
 * Hover/keyboard focus gives an immediate, gentle static brightening.
 */
export default function ProductGlow({
  hovered,
  lifeDelay,
  lifeCycleSeconds,
}: Props) {
  return (
    <div
      aria-hidden="true"
      className="pupson-product-glow pointer-events-none absolute inset-0"
      data-hovered={hovered ? "true" : "false"}
      data-ambient={lifeDelay === null ? "false" : "true"}
      style={{
        "--pupson-glow-cycle": `${lifeCycleSeconds}s`,
        "--pupson-glow-delay": `-${lifeDelay ?? 0}s`,
      } as CSSProperties}
    />
  );
}
