"use client";

import Hotspot from "./Hotspot";
import { hotspots, Hotspot as HotspotConfig } from "@/data/hotspots";
import {
  LIFE_CYCLE_SECONDS,
  lifeDelayById,
  lifeGlowKeyframesCSS,
} from "@/lib/lifeGlow";

interface Props {
  onSelect: (hotspot: HotspotConfig) => void;
  /** pause the ambient ping sequence, e.g. while the panel/cart is open */
  paused?: boolean;
}

/**
 * Renders every hotspot defined in data/hotspots.ts, and assigns each one
 * its slot in the guided-tour sequence (see lib/lifeGlow.ts). Two ambient
 * layers run per hotspot: an always-on subtle breathing aura (every
 * product, all the time), and a faster guided-tour flash + rings that take
 * turns in sequence to sweep attention around the store. Both are pure CSS
 * underneath, so it costs nothing in JS regardless of how many products
 * are on shelf.
 */
export default function Hotspots({ onSelect, paused }: Props) {
  return (
    <div className="absolute inset-0">
      {/* Shared keyframes for every hotspot's ping — injected once here
          rather than per-hotspot, since they're identical for all of them. */}
      <style>{lifeGlowKeyframesCSS}</style>

      {hotspots.map((hotspot) => (
        <Hotspot
          key={hotspot.id}
          hotspot={hotspot}
          lifeDelay={paused ? null : lifeDelayById.get(hotspot.id) ?? null}
          lifeCycleSeconds={LIFE_CYCLE_SECONDS}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
