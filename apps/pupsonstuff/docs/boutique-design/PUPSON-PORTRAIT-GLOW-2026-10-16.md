# PUPSON-PORTRAIT-GLOW.01–.04 — Mobile visual tuning

**Date:** 2026-10-16. **Source:** owner report: product flashing seems scattered, and the boutique is only meaningfully visible in landscape.

## Root cause and chosen repair
- Before: `Hotspots.tsx` shuffled phases on every 1.8s-or-cycle interval, affecting CSS pulse animation offsets while they were already running; `ProductGlow.tsx` rendered a bright constant aura on every item and scaled SVG rings to 1.55, extending outside their silhouette.
- Now: stable, non-overlapping 1.6s per-item attention sequence, confined to each actual silhouette clip path. Ring expansions and concurrent breathing overlays removed. Hover/keyboard focus remains a quiet warm brighten. The 240ms lifted-product clone remains.
- Before: landscape/desktop could see the whole photo, but portrait entered a wide, full-height horizontally cropped area with no discoverable whole-room option.
- Now: portrait opens with a fitted full-room view, plus **Explore room ↔** to switch to full-height pan; **View whole room** to return. Department shortcuts focus their source-image percentages and leave overview automatically. Original photo stays unmodified, photo and hotspots share one stage, exact 1568:1003 aspect ratio remains invariant.
- Touch controls are explicitly horizontal-pan-friendly, and mouse hover is not simulated by a touch gesture. Reduced-motion preferences stop ambient animation.
- Desktop maintains its full-room ratio fit with stage height bounded by screen width and height; no letterboxing mismatch.

## Proof required before considering repaired in production
- Vitest regression: viewport pan geometry, hotspots inside photo bounds, one-at-a-time stable pulses.
- PupsonStuff TS, lint, tests and production build, Cloudflare local workerd, Spatial and Jhadina Launch Gate all green.
- After merge, **owner manually runs the existing cloudflare-preview workflow on new main**; never silently rerun an old SHA. View-only protection stays true; Stripe/Printify/creative APIs remain disabled.
- Check live 390x844 and 430x932 iPhone portrait at entry, after Explore, during horizontal swipe and product tap; compare photo pixel locations with user screenshot. Confirm both landscape and desktop too.
- Individual silhouette positioning is still hand-fit, not pixel-traced; a phone screenshot is needed for further item-by-item bounding refinements, which must be done against the canonical image not by arbitrary coordinate guesses.
