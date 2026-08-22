"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import BoutiqueImage from "./BoutiqueImage";
import Hotspots from "./Hotspots";
import ProductModal from "./ProductModal";
import MusicToggle from "./MusicToggle";
import CartButton from "./CartButton";
import CartDrawer from "./CartDrawer";
import Scene3DErrorBoundary from "./Scene3DErrorBoundary";
import { ActiveProduct } from "@/types/boutique";
import { MusicProvider } from "@/context/MusicContext";
import { isWebGLAvailable } from "@/lib/webgl";

// three.js/@react-three/fiber need the browser (WebGL) — same reasoning
// as Product3DEngine's dynamic import in ProductModal.tsx. This is a
// SEPARATE dynamic import from that one: this loads the environment-level
// scene, not a product. Product3DEngine itself still only ever gets
// loaded from inside ProductModal, unchanged — tapping a hotspot in 3D
// mode hands off to the exact same modal/engine flat mode already uses.
const BoutiqueScene = dynamic(() => import("./BoutiqueScene"), {
  ssr: false,
});

type Mode = "3d" | "flat";

export default function Boutique() {
  const [activeProduct, setActiveProduct] = useState<ActiveProduct | null>(
    null
  );

  // null = not checked yet (server render / before first effect). Real
  // capability detection, not an assumption — see lib/webgl.ts.
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("flat");
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const supported = isWebGLAvailable();
    setWebglSupported(supported);
    // Default to the 3D boutique when it's actually possible; otherwise
    // stay on the flat photo without ever attempting to mount the scene.
    if (supported) setMode("3d");
  }, []);

  const show3D = mode === "3d" && webglSupported && !sceneFailed;

  // The "checkout" hotspot (data/hotspots.ts) has no fulfillment/pricing
  // of its own — it was never a real product to customize, just a spot
  // on the photo that used to open ProductModal only to show a "not
  // wired up yet" placeholder. Intercepted here, before that placeholder
  // is ever reached, so it opens the real cart instead — for both the
  // flat-photo hotspot layer and the 3D scene's hotspots, which both
  // call this same handler now instead of setActiveProduct directly.
  const handleSelectHotspot = (hotspot: ActiveProduct) => {
    if (hotspot.product === "checkout") {
      setCartOpen(true);
      return;
    }
    setActiveProduct(hotspot);
  };

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
              <BoutiqueScene
                onSelectHotspot={handleSelectHotspot}
                onReady={() => setSceneReady(true)}
              />
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
          /*
            This single box is the source of truth for both the image and the
            hotspot layer's dimensions. Using the exact photo aspect ratio
            (1568x1003) rather than an approximated Tailwind fraction keeps
            object-contain's letterboxing identical for both children, so
            hotspots never drift off their products at any viewport size.
          */
          <div
            className="relative mx-auto w-full max-w-[1800px]"
            style={{ aspectRatio: "1568 / 1003" }}
          >
            <BoutiqueImage />
            <Hotspots onSelect={handleSelectHotspot} paused={!!activeProduct} />
          </div>
        )}

        <ProductModal
          activeProduct={activeProduct}
          onClose={() => setActiveProduct(null)}
        />

        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
        <CartButton onClick={() => setCartOpen(true)} />

        {webglSupported && (
          <ModeToggle
            mode={mode}
            onChange={(next) => {
              // Re-entering 3D after a failure is allowed — a transient
              // WebGL context loss shouldn't permanently lock the user out
              // of the mode that was actually requested.
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
      The 3D boutique couldn&apos;t load on this device — showing the photo
      view instead.
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
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-x-0 top-6 flex justify-center"
        >
          <span className="rounded-full bg-ink/70 px-4 py-2 text-xs text-cream/90 backdrop-blur-sm">
            Drag to look around · Pinch to zoom · Tap a product to view it
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  return (
    <div className="fixed bottom-5 left-5 z-30 flex overflow-hidden rounded-full bg-ink/80 text-xs font-medium text-cream backdrop-blur">
      <button
        type="button"
        onClick={() => onChange("3d")}
        aria-pressed={mode === "3d"}
        className={`px-4 py-2.5 transition ${mode === "3d" ? "bg-bronze text-cream" : "text-cream/60 hover:text-cream"}`}
      >
        3D Boutique
      </button>
      <button
        type="button"
        onClick={() => onChange("flat")}
        aria-pressed={mode === "flat"}
        className={`px-4 py-2.5 transition ${mode === "flat" ? "bg-bronze text-cream" : "text-cream/60 hover:text-cream"}`}
      >
        Photo View
      </button>
    </div>
  );
}
