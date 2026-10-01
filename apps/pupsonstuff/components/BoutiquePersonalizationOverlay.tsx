'use client';

import { motion } from 'framer-motion';
import { hotspots } from '@/data/hotspots';
import { silhouetteClipPath } from '@/lib/silhouettes';

export default function BoutiquePersonalizationOverlay({
  previewUrl,
}: {
  previewUrl: string | null | undefined;
}) {
  if (!previewUrl) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[6]" aria-hidden="true">
      {hotspots
        .filter((hotspot) => Boolean(hotspot.fulfillment))
        .map((hotspot, index) => (
          <motion.div
            key={hotspot.id}
            className="absolute overflow-hidden"
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.42, delay: Math.min(index * 0.025, 0.28) }}
            style={{
              left: `${hotspot.x}%`,
              top: `${hotspot.y}%`,
              width: `${hotspot.width}%`,
              height: `${hotspot.height}%`,
              clipPath: silhouetteClipPath(hotspot.silhouette),
            }}
          >
            <div className="absolute inset-[18%] flex items-center justify-center opacity-80 mix-blend-multiply">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt=""
                draggable={false}
                className="h-full w-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.28)]"
              />
            </div>
          </motion.div>
        ))}
    </div>
  );
}
