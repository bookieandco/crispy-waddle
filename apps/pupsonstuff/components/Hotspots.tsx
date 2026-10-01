'use client';

import { useEffect, useState } from 'react';
import Hotspot from './Hotspot';
import { hotspots, type Hotspot as HotspotConfig } from '@/data/hotspots';
import {
  GLOW_STEP_SECONDS,
  LIFE_CYCLE_SECONDS,
  LIFE_SEQUENCE,
  lifeGlowKeyframesCSS,
} from '@/lib/lifeGlow';

interface Props {
  onSelect: (hotspot: HotspotConfig) => void;
  paused?: boolean;
}

function randomizedDelays(): Map<string, number> {
  const shuffled = [...LIFE_SEQUENCE];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[next]] = [shuffled[next], shuffled[index]];
  }
  return new Map(shuffled.map((hotspot, index) => [hotspot.id, index * GLOW_STEP_SECONDS]));
}

export default function Hotspots({ onSelect, paused }: Props) {
  const [delays, setDelays] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (paused) return;
    const reroll = () => setDelays(randomizedDelays());
    reroll();
    const interval = window.setInterval(reroll, Math.max(1800, LIFE_CYCLE_SECONDS * 1000));
    return () => window.clearInterval(interval);
  }, [paused]);

  return (
    <div className="absolute inset-0 z-10">
      <style>{lifeGlowKeyframesCSS}</style>
      {hotspots.map((hotspot) => (
        <Hotspot
          key={hotspot.id}
          hotspot={hotspot}
          lifeDelay={paused ? null : delays.get(hotspot.id) ?? null}
          lifeCycleSeconds={LIFE_CYCLE_SECONDS}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
