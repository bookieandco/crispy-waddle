"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getInteractionLabel, type InteractionMode } from "@/lib/interactive-experience";

/**
 * Product-first mobile presentation layer.
 *
 * The room remains the immersive background, but selecting a product lifts it
 * into a large foreground "stage". The generated pet artwork is shown inside
 * the preview card and the customer can edit/re-generate without losing the
 * scene context.
 */
export default function InteractiveExperienceLayer() {
  const [mode, setMode] = useState<InteractionMode>("orbit");
  const [showHint, setShowHint] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setShowHint(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onProductSelect = (event: Event) => {
      const detail = (event as CustomEvent<{ productId?: string; previewUrl?: string }>).detail;
      setSelectedProduct(detail.productId ?? null);
      setPreviewUrl(detail.previewUrl ?? null);
    };

    window.addEventListener("pupsonstuff:product-select", onProductSelect);
    return () => window.removeEventListener("pupsonstuff:product-select", onProductSelect);
  }, []);

  const closeProduct = () => {
    setSelectedProduct(null);
    setPreviewUrl(null);
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
        <motion.div aria-hidden="true" className="absolute -left-24 top-1/3 h-48 w-48 rounded-full bg-gold/10 blur-3xl" animate={{ x: [0, 35, 0], y: [0, -25, 0], scale: [1, 1.12, 1] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div aria-hidden="true" className="absolute -right-20 bottom-1/4 h-56 w-56 rounded-full bg-bronze/10 blur-3xl" animate={{ x: [0, -30, 0], y: [0, 20, 0], scale: [1.05, 1, 1.05] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }} />
      </div>

      <div className="fixed right-5 top-5 z-30 flex items-center gap-1 rounded-full border border-cream/10 bg-ink/65 p-1 text-[10px] text-cream/70 backdrop-blur-md">
        {(["orbit", "inspect"] as const).map((next) => (
          <button key={next} type="button" onClick={() => setMode(next)} className={`rounded-full px-3 py-1.5 capitalize transition ${mode === next ? "bg-cream/10 text-cream" : "hover:text-cream"}`} aria-pressed={mode === next}>{next}</button>
        ))}
      </div>

      {showHint && !selectedProduct && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pointer-events-none fixed bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-full border border-cream/10 bg-ink/70 px-4 py-2 text-center text-[11px] text-cream/80 shadow-lg backdrop-blur-md">
          {getInteractionLabel(mode)} · Tap a product to bring it forward
        </motion.div>
      )}

      <AnimatePresence>
        {selectedProduct && (
          <motion.section
            initial={{ opacity: 0, y: "100%", scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: "100%", scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="fixed inset-x-3 bottom-3 top-16 z-50 flex flex-col overflow-hidden rounded-[2rem] border border-cream/15 bg-ink/95 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:left-1/2 sm:w-[min(92vw,720px)] sm:-translate-x-1/2"
            aria-label="Product editor"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-gold">Your creation</p>
                <h2 className="mt-1 text-lg font-semibold text-cream">Customize your {selectedProduct}</h2>
              </div>
              <button type="button" onClick={closeProduct} className="rounded-full border border-cream/10 px-3 py-2 text-xs text-cream/70 hover:text-cream">Close</button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-gradient-to-b from-bronze/15 via-ink to-ink px-5 py-4">
              <motion.div initial={{ y: 30, rotateX: 8 }} animate={{ y: 0, rotateX: 0 }} className="relative flex h-full max-h-[58vh] w-full max-w-[560px] items-center justify-center rounded-[1.5rem] border border-cream/10 bg-cream/[0.035] p-4 shadow-[0_30px_100px_rgba(0,0,0,.45)]">
                {previewUrl ? (
                  <img src={previewUrl} alt="Your generated pet artwork preview" className="max-h-full max-w-full object-contain drop-shadow-2xl" />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center text-cream/60">
                    <div className="h-28 w-28 animate-pulse rounded-2xl bg-cream/10" />
                    <p className="text-sm">Generate your pet artwork to preview it here.</p>
                  </div>
                )}
              </motion.div>
            </div>

            <div className="border-t border-cream/10 bg-ink/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex gap-2">
                <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Change the style…" className="min-w-0 flex-1 rounded-xl border border-cream/10 bg-cream/5 px-4 py-3 text-sm text-cream outline-none placeholder:text-cream/35 focus:border-gold/50" />
                <button type="button" className="rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-ink transition hover:scale-[1.02]">Preview</button>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {["Watercolor", "Royal", "Cartoon", "Pop Art", "Vintage"].map((style) => (
                  <button key={style} type="button" onClick={() => setPrompt(style)} className={`shrink-0 rounded-full border px-3 py-2 text-xs ${prompt === style ? "border-gold bg-gold/10 text-gold" : "border-cream/10 text-cream/65"}`}>{style}</button>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
