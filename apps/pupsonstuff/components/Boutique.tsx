"use client";

import { useState } from "react";
import BoutiqueImage from "./BoutiqueImage";
import Hotspots from "./Hotspots";
import ProductModal from "./ProductModal";
import MusicToggle from "./MusicToggle";
import { ActiveProduct } from "@/types/boutique";
import { MusicProvider } from "@/context/MusicContext";

export default function Boutique() {
  const [activeProduct, setActiveProduct] = useState<ActiveProduct | null>(
    null
  );

  return (
    <MusicProvider>
      <main className="relative flex min-h-screen items-center bg-ink">
        {/*
          This single box is the source of truth for both the image and the
          hotspot layer's dimensions. Using the exact photo aspect ratio
          (1568x1003) rather than an approximated Tailwind fraction keeps
          object-contain's letterboxing identical for both children, so
          hotspots never drift off their products at any viewport size.
        */}
        <div
          className="relative mx-auto w-full max-w-[1800px]"
          style={{ aspectRatio: "1568 / 1003" }}
        >
          <BoutiqueImage />
          <Hotspots onSelect={setActiveProduct} paused={!!activeProduct} />
        </div>

        <ProductModal
          activeProduct={activeProduct}
          onClose={() => setActiveProduct(null)}
        />

        <MusicToggle />
      </main>
    </MusicProvider>
  );
}
