'use client';

import { useEffect, useRef, useState } from 'react';
import BoutiqueImage from './BoutiqueImage';
import Hotspots from './Hotspots';
import ProductModal from './ProductModal';
import MusicToggle from './MusicToggle';
import CartButton from './CartButton';
import CartDrawer from './CartDrawer';
import DepartmentNav from './DepartmentNav';
import BoutiquePersonalizationOverlay from './BoutiquePersonalizationOverlay';
import type { ActiveProduct } from '@/types/boutique';
import { MusicProvider } from '@/context/MusicContext';
import { usePetIdentity } from '@/context/PetIdentityContext';

export default function Boutique() {
  const [activeProduct, setActiveProduct] = useState<ActiveProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const { latestArtwork, setLatestArtwork, setActivePet } = usePetIdentity();

  useEffect(() => {
    const scroller = scrollerRef.current;
    const stage = stageRef.current;
    if (!scroller || !stage || window.matchMedia('(min-width: 768px)').matches) return;
    const frame = window.requestAnimationFrame(() => {
      const target = stage.scrollWidth * 0.48 - scroller.clientWidth / 2;
      scroller.scrollLeft = Math.max(0, target);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const selectProduct = (product: ActiveProduct) => {
    if (product.product === 'checkout') {
      setCartOpen(true);
      return;
    }
    setActiveProduct(product);
  };

  const focusDepartment = (xPercent: number) => {
    const scroller = scrollerRef.current;
    const stage = stageRef.current;
    if (!scroller || !stage) return;
    const left = (stage.scrollWidth * xPercent) / 100 - scroller.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  };

  return (
    <MusicProvider>
      <main className="relative h-[100dvh] overflow-hidden bg-ink">
        <div
          ref={scrollerRef}
          className="h-[100dvh] w-full overflow-x-auto overflow-y-hidden overscroll-x-contain md:flex md:items-center md:justify-center md:overflow-hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          <div
            ref={stageRef}
            className="relative h-[100dvh] w-auto shrink-0 aspect-[1568/1003] md:h-auto md:w-full md:max-w-[1800px]"
          >
            <BoutiqueImage />

            {/* Keep the canonical photography intact while giving the room a
                barely-there warm boutique atmosphere. */}
            <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(circle_at_50%_35%,rgba(255,226,177,0.08),transparent_48%),linear-gradient(to_bottom,rgba(255,230,190,0.025),rgba(16,12,8,0.06))]" />

            <BoutiquePersonalizationOverlay previewUrl={latestArtwork?.previewUrl} />
            <Hotspots onSelect={selectProduct} paused={!!activeProduct || cartOpen} />
          </div>
        </div>

        <ProductModal
          activeProduct={activeProduct}
          onClose={() => setActiveProduct(null)}
          onPreviewReady={(artwork) => {
            setActivePet({ id: artwork.petIdentityId, name: artwork.petName });
            setLatestArtwork(artwork);
          }}
        />

        <CartButton onClick={() => setCartOpen(true)} />
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
        <DepartmentNav onFocus={focusDepartment} />
        <MusicToggle />
      </main>
    </MusicProvider>
  );
}
