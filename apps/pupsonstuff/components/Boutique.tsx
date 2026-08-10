"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import BoutiqueImage from "./BoutiqueImage";
import Hotspots from "./Hotspots";
import ProductModal from "./ProductModal";
import MobileProductStage from "./MobileProductStage";
import MusicToggle from "./MusicToggle";
import Scene3DErrorBoundary from "./Scene3DErrorBoundary";
import { ActiveProduct } from "@/types/boutique";
import { MusicProvider } from "@/context/MusicContext";
import { isWebGLAvailable } from "@/lib/webgl";

const BoutiqueScene = dynamic(() => import("./BoutiqueScene"), { ssr: false });

type Mode = "3d" | "flat";

export default function Boutique() {
  const [activeProduct, setActiveProduct] = useState<ActiveProduct | null>(null);
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("flat");
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);

  useEffect(() => {
    const supported = isWebGLAvailable();
    setWebglSupported(supported);
    if (supported) setMode("3d");
  }, []);

  const show3D = mode === "3d" && webglSupported && !sceneFailed;

  return (
    <MusicProvider>
      <main className="relative flex min-h-screen items-center justify-center bg-ink">
        {show3D ? (
          <div className="relative h-[100dvh] w-full">
            <Scene3DErrorBoundary
              fallback={<FlatFallbackNotice />}
              onError={() => {
                setSceneFailed(true);
                setMode("flat");
              }}
            >
              <BoutiqueScene onSelectHotspot={setActiveProduct} onReady={() => setSceneReady(true)} />
            </Scene3DErrorBoundary>
            {!sceneReady && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink">
                <div className="flex flex-col items-center gap-3 text-cream/80">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-cream/30 border-t-gold" />
                  <span className="text-sm">Loading 3D boutique…</span>
                </div>
              </div>
            )}
            {sceneReady && <TouchHint />}
          </div>
        ) : (
          <div className="relative mx-auto w-full max-w-[1800px]" style={{ aspectRatio: "1568 / 1003" }}>
            <BoutiqueImage />
            <Hotspots onSelect={setActiveProduct} paused={!!activeProduct} />
          </div>
        )}

        <ProductModal activeProduct={activeProduct} onClose={() => setActiveProduct(null)} />
        <MobileProductStage product={activeProduct} onClose={() => setActiveProduct(null)} />

        {webglSupported && (
          <ModeToggle
            mode={mode}
            onChange={(next) => {
              if (next === "3d") setSceneFailed(false);
              setMode(next);
            }}
          />
        )}
        <MusicToggle />
      </main>
    </MusicProvider>
  );
}

function FlatFallbackNotice() {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-ink px-6 text-center text-sm text-cream/70">
      The 3D boutique couldn&apos;t load on this device — showing the photo view instead.
    </div>
  );
}

function TouchHint() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(false), 3500);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
          <span className="rounded-full bg-ink/70 px-4 py-2 text-xs text-cream/90 backdrop-blur-sm">Drag to look around · Pinch to zoom · Tap a product to view it</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-30 flex overflow-hidden rounded-full bg-ink/80 text-xs font-medium text-cream backdrop-blur">
      <button type="button" onClick={() => onChange("3d")} aria-pressed={mode === "3d"} className={`px-4 py-2.5 transition ${mode === "3d" ? "bg-bronze text-cream" : "text-cream/60 hover:text-cream"}`}>3D Boutique</button>
      <button type="button" onClick={() => onChange("flat")} aria-pressed={mode === "flat"} className={`px-4 py-2.5 transition ${mode === "flat" ? "bg-bronze text-cream" : "text-cream/60 hover:text-cream"}`}>Photo View</button>
    </div>
  );
}
