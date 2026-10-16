// Quiet, silhouette-attached boutique attention passes.
// A product gets one short subtle brighten before attention moves to the
// next product; no expanding SVG rings, independent breathing overlays,
// re-randomization loops, or overlapping 300 ms strobe-like pings.
import { hotspots, type Hotspot } from '@/data/hotspots';

export const LIFE_SEQUENCE: Hotspot[] = hotspots
  .filter((hotspot) => hotspot.product !== 'checkout')
  .sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));

/** One item at a time, enough separation for calm browsing. */
export const GLOW_STEP_SECONDS = 1.6;
export const LIFE_CYCLE_SECONDS = LIFE_SEQUENCE.length * GLOW_STEP_SECONDS;
export const GLOW_DURATION_SECONDS = 0.9;
export const lifeDelayById = new Map(
  LIFE_SEQUENCE.map((hotspot, index) => [hotspot.id, index * GLOW_STEP_SECONDS])
);
