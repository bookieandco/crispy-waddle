"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMusic } from "@/context/MusicContext";

export default function MusicToggle() {
  const { enabled, toggle, volume, setVolume } = useMusic();
  const [showVolume, setShowVolume] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-2">
      <AnimatePresence>
        {showVolume && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="rounded-full bg-ink/80 px-4 py-3 backdrop-blur"
          >
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24 accent-gold"
              aria-label="Music volume"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={toggle}
        onMouseEnter={() => setShowVolume(true)}
        onMouseLeave={() => setShowVolume(false)}
        aria-label={enabled ? "Pause boutique music" : "Play boutique music"}
        aria-pressed={enabled}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/80 text-cream shadow-lg backdrop-blur transition hover:bg-ink"
      >
        {enabled ? (
          // pause icon
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="4" height="12" rx="1" />
            <rect x="9" y="2" width="4" height="12" rx="1" />
          </svg>
        ) : (
          // play / note icon
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2v9.2a2.6 2.6 0 1 0 1.3 2.25V6.1l6-1.2v5.3a2.6 2.6 0 1 0 1.3 2.25V1L4 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
