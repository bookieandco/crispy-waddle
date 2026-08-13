"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ProductGlow from "./ProductGlow";
import { Hotspot as HotspotConfig } from "@/data/hotspots";
import { silhouetteClipPath } from "@/lib/silhouettes";

interface Props {
  hotspot: HotspotConfig;
  /** this hotspot's slot in the guided-tour sequence, seconds; null = no ambient effects */
  lifeDelay: number | null;
  lifeCycleSeconds: number;
  onSelect: (hotspot: HotspotConfig) => void;
}

export default function Hotspot({
  hotspot,
  lifeDelay,
  lifeCycleSeconds,
  onSelect,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const [tapping, setTapping] = useState(false);

  // The clickable area itself is now clipped to the product's silhouette —
  // clicks/taps outside the shape (but inside the bounding box) pass
  // through to whatever's behind. The product IS the hotspot, not a
  // rectangle drawn around it.
  const clipPath = silhouetteClipPath(hotspot.silhouette);

  const handleTapStart = () => {
    setTapping(true);
    window.setTimeout(() => setTapping(false), 100);
  };

  return (
    <motion.button
      type="button"
      aria-label={hotspot.name}
      className="absolute cursor-pointer outline-none"
      style={{
        left: `${hotspot.x}%`,
        top: `${hotspot.y}%`,
        width: `${hotspot.width}%`,
        height: `${hotspot.height}%`,
        clipPath,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={() => onSelect(hotspot)}
      onTouchStart={handleTapStart}
      animate={{
        scale: hovered || tapping ? 1.03 : 1,
        y: hovered ? -3 : 0,
      }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {/* Drop shadow, only visible on hover — clipped area means a plain
          box-shadow on this element would be cut by clip-path, so this
          uses filter:drop-shadow which respects the clipped alpha shape. */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={false}
        animate={{
          filter: hovered
            ? "drop-shadow(0 6px 14px rgba(0,0,0,0.3))"
            : "drop-shadow(0 0px 0px rgba(0,0,0,0))",
        }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      />

      <ProductGlow
        hovered={hovered}
        lifeDelay={lifeDelay}
        lifeCycleSeconds={lifeCycleSeconds}
        silhouette={hotspot.silhouette}
      />
    </motion.button>
  );
}
