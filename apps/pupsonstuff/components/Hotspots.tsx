'use client';

import { useState } from 'react';
import Hotspot from './Hotspot';
import { hotspots, type Hotspot as HotspotConfig } from '@/data/hotspots';
import { LIFE_CYCLE_SECONDS, lifeDelayById } from '@/lib/lifeGlow';

interface Props {
  onSelect: (hotspot: HotspotConfig) => void;
  paused?: boolean;
}

/** Product pulses keep one stable phase throughout the visit.
 * Do not reshuffle animation-delay while CSS animations are running:
 * doing so triggers disjoint flashes across the room, especially on iOS.
 */
export default function Hotspots({ onSelect, paused = false }: Props) {
  const [attendedId, setAttendedId] = useState<string | null>(null);
  return (
    <div className="absolute inset-0 z-10">
      {hotspots.map((hotspot) => (
        <Hotspot
          key={hotspot.id}
          hotspot={hotspot}
          lifeDelay={paused || attendedId !== null ? null : lifeDelayById.get(hotspot.id) ?? null}
          onAttentionChange={setAttendedId}
          lifeCycleSeconds={LIFE_CYCLE_SECONDS}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
