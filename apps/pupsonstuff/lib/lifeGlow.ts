// lib/lifeGlow.ts
//
// Two independent ambient layers now, per the "Product Interaction Update"
// spec:
//
// 1. BREATHING — every clickable product, all at once, all the time: a very
//    subtle brightness pulse (1.1-1.4s cycle, ~20% opacity, screen blend)
//    that just says "I'm interactive." This never stops, never pauses for
//    sequencing — only for hover/panel-open on that specific product.
//
// 2. GUIDED TOUR — the staggered "ping" from before, sped up: each product
//    gets a quick flash + a couple of expanding rings, in sequence, guiding
//    the eye around the store (per the spec's example: wall art at 0.0s,
//    hoodie at 0.3s, mug at 0.6s, ...). This is the more noticeable,
//    attention-directing layer; breathing is the constant baseline under it.
//
// Same phase-shift trick as before: every hotspot shares one
// animation-duration (LIFE_CYCLE_SECONDS) and is offset with a negative
// animation-delay, so the whole guided-tour sequence is pure CSS, no JS
// interval. True per-lap *randomization* ("then repeat randomly") would
// need a JS-driven scheduler instead of pure CSS — this repeats in a fixed
// order, which still reads as a natural sweep around the store; flagged in
// the README if you want the fully random version instead.

import { hotspots, Hotspot } from "@/data/hotspots";

// "Checkout" isn't a product to draw attention to.
export const LIFE_SEQUENCE: Hotspot[] = hotspots.filter(
  (h) => h.product !== "checkout"
);

/** Seconds between one product's guided-tour turn and the next starting. */
export const GLOW_STEP_SECONDS = 0.3;

/** Full lap of the guided-tour sequence. */
export const LIFE_CYCLE_SECONDS = LIFE_SEQUENCE.length * GLOW_STEP_SECONDS;

/** How long a single ring takes to expand and fade. */
export const RING_DURATION_SECONDS = 0.45;
/** Delay between successive rings within one product's flash. */
export const RING_STAGGER_SECONDS = 0.07;
export const RING_COUNT = 2;

/** The always-on breathing cycle, shared by every product, per spec: 1.1-1.4s. */
export const BREATHE_CYCLE_SECONDS = 1.25;

export const lifeDelayById = new Map<string, number>(
  LIFE_SEQUENCE.map((h, i) => [h.id, i * GLOW_STEP_SECONDS])
);

const ringWindowPct = (RING_DURATION_SECONDS / LIFE_CYCLE_SECONDS) * 100;
const coreWindowPct = ringWindowPct * 0.55;

/**
 * Injected once via a <style> tag (see Hotspots.tsx).
 * - life-ping-core: brightens the actual boutique photo pixels behind the
 *   product's silhouette mask (backdrop-filter) for a quick flash.
 * - life-ping-ring: rendered RING_COUNT times per product with increasing
 *   delay. Starts AT the product's own silhouette (scale 1) and expands
 *   outward from there.
 * - breathe: the always-on layer, identical timing for every product,
 *   never phase-shifted (it's not a sequence, everything breathes together).
 */
export const lifeGlowKeyframesCSS = `
@keyframes life-ping-core {
  0% { backdrop-filter: brightness(1) saturate(1); -webkit-backdrop-filter: brightness(1) saturate(1); }
  2% { backdrop-filter: brightness(1.55) saturate(1.4); -webkit-backdrop-filter: brightness(1.55) saturate(1.4); }
  ${coreWindowPct.toFixed(2)}% { backdrop-filter: brightness(1) saturate(1); -webkit-backdrop-filter: brightness(1) saturate(1); }
  100% { backdrop-filter: brightness(1) saturate(1); -webkit-backdrop-filter: brightness(1) saturate(1); }
}
@keyframes life-ping-ring {
  0% { opacity: 0.7; transform: scale(1); }
  ${ringWindowPct.toFixed(2)}% { opacity: 0; transform: scale(1.55); }
  100% { opacity: 0; transform: scale(1); }
}
@keyframes life-breathe {
  0%, 100% { opacity: 0.14; }
  50% { opacity: 0.30; }
}
`;
