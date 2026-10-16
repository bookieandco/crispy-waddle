'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ProductGlow from './ProductGlow';
import type { Hotspot as HotspotConfig } from '@/data/hotspots';
import { silhouetteClipPath } from '@/lib/silhouettes';
import { playBoutiqueChime } from '@/lib/boutique-sfx';

interface Props {
  hotspot: HotspotConfig;
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
  const [lifting, setLifting] = useState(false);
  const timerRef = useRef<number | null>(null);
  const clipPath = silhouetteClipPath(hotspot.silhouette);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const handleSelect = () => {
    if (lifting) return;
    playBoutiqueChime('tap');
    setLifting(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      onSelect(hotspot);
      setLifting(false);
      timerRef.current = null;
    }, 240);
  };

  const backgroundPositionX =
    hotspot.width >= 100 ? 50 : (hotspot.x / Math.max(0.01, 100 - hotspot.width)) * 100;
  const backgroundPositionY =
    hotspot.height >= 100 ? 50 : (hotspot.y / Math.max(0.01, 100 - hotspot.height)) * 100;

  return (
    <motion.button
      type="button"
      aria-label={hotspot.name}
      className="absolute cursor-pointer outline-none touch-pan-x"
      style={{
        left: `${hotspot.x}%`,
        top: `${hotspot.y}%`,
        width: `${hotspot.width}%`,
        height: `${hotspot.height}%`,
        clipPath,
        zIndex: lifting ? 40 : undefined,
      }}
      onPointerEnter={(event) => {
        // Touch gestures pan the portrait room, not trigger desktop hover.
        if (event.pointerType === 'mouse' || event.pointerType === 'pen') setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={handleSelect}
      animate={{
        scale: lifting ? 1.08 : 1,
        y: lifting ? -5 : 0,
        filter: lifting
          ? 'drop-shadow(0 12px 12px rgba(0,0,0,.30))'
          : 'drop-shadow(0 0 0 rgba(0,0,0,0))',
      }}
      transition={{ duration: lifting ? 0.22 : 0.16, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        initial={false}
        animate={{ opacity: lifting ? 1 : 0 }}
        style={{
          backgroundImage: "url('/boutique.png')",
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${10000 / hotspot.width}% ${10000 / hotspot.height}%`,
          backgroundPosition: `${backgroundPositionX}% ${backgroundPositionY}%`,
        }}
      />

      <ProductGlow
        hovered={hovered || lifting}
        lifeDelay={lifeDelay}
        lifeCycleSeconds={lifeCycleSeconds}
        silhouette={hotspot.silhouette}
      />
    </motion.button>
  );
}
