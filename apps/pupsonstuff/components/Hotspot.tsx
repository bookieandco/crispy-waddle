'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ProductGlow from './ProductGlow';
import type { Hotspot as HotspotConfig } from '@/data/hotspots';
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
      animate={{ scale: lifting ? 1.03 : 1, y: lifting ? -2 : 0 }}
      transition={{ duration: lifting ? 0.22 : 0.16, ease: [0.22, 1, 0.36, 1] }}
    >


      <ProductGlow
        hovered={hovered || lifting}
        lifeDelay={lifeDelay}
        lifeCycleSeconds={lifeCycleSeconds}
      />
    </motion.button>
  );
}
