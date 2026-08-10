"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getInteractionLabel, type InteractionMode } from "@/lib/interactive-experience";

/**
 * Engine-style presentation layer. It is deliberately renderer-agnostic:
 * the existing Three.js boutique remains responsible for the scene while
 * this layer adds lightweight stateful feedback, ambient motion and mobile
 * guidance on top of it.
 */
export default function InteractiveExperienceLayer() {
  const [mode, setMode] = useState<InteractionMode>("orbit");
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowHint(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
        <motion.div
          aria-hidden="true"
          className="absolute -left-24 top-1/3 h-48 w-48 rounded-full bg-gold/10 blur-3xl"
          animate={{ x: [0, 35, 0], y: [0, -25, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden="true"
          className="absolute -right-20 bottom-1/4 h-56 w-56 rounded-full bg-bronze/10 blur-3xl"
          animate={{ x: [0, -30, 0], y: [0, 20, 0], scale: [1.05, 1, 1.05] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="fixed right-5 top-5 z-30 flex items-center gap-1 rounded-full border border-cream/10 bg-ink/65 p-1 text-[10px] text-cream/70 backdrop-blur-md">
        {(["orbit", "inspect"] as const).map((next) => (
          <button
            key={next}
            type="button"
            onClick={() => setMode(next)}
            className={`rounded-full px-3 py-1.5 capitalize transition ${
              mode === next ? "bg-cream/10 text-cream" : "hover:text-cream"
            }`}
            aria-pressed={mode === next}
          >
            {next}
          </button>
        ))}
      </div>

      {showHint && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="pointer-events-none fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-full border border-cream/10 bg-ink/70 px-4 py-2 text-center text-[11px] text-cream/80 shadow-lg backdrop-blur-md"
        >
          {getInteractionLabel(mode)}
        </motion.div>
      )}
    </>
  );
}
