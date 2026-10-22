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
import { boutiquePanLeft } from '@/lib/boutique-viewport';
import type { ActiveProduct } from '@/types/boutique';
import { MusicProvider } from '@/context/MusicContext';
import { usePetIdentity } from '@/context/PetIdentityContext';

export default function Boutique() {
  const [activeProduct, setActiveProduct] = useState<ActiveProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  // Portrait enters the immersive, full-height room. Fitting the whole wide
  // photo inside a portrait screen makes a tiny postcard with empty bands.
  // The whole-room map remains one tap away instead of being the landing view.
  const [overview, setOverview] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const focusAfterLayout = useRef<number>(48);
  const { latestArtwork, setLatestArtwork, setActivePet } = usePetIdentity();

  useEffect(() => {
    const scroller = scrollerRef.current;
    const stage = stageRef.current;
    if (!scroller || !stage) return;
    const position = () => {
      const portrait = window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches;
      if (portrait && overview) return;
      scroller.scrollLeft = boutiquePanLeft(
        stage.getBoundingClientRect().width,
        scroller.clientWidth,
        focusAfterLayout.current,
      );
    };
    const frame = window.requestAnimationFrame(position);
    window.addEventListener('resize', position, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', position);
    };
  }, [overview]);

  const selectProduct = (product: ActiveProduct) => {
    if (product.product === 'checkout') {
      setCartOpen(true);
      return;
    }
    setActiveProduct(product);
  };

  const focusDepartment = (xPercent: number) => {
    focusAfterLayout.current = xPercent;
    if (overview) {
      setOverview(false);
      return;
    }
    const scroller = scrollerRef.current;
    const stage = stageRef.current;
    if (!scroller || !stage) return;
    scroller.scrollTo({
      left: boutiquePanLeft(stage.getBoundingClientRect().width, scroller.clientWidth, xPercent),
      behavior: 'smooth',
    });
  };

  const toggleOverview = () => {
    if (!overview && stageRef.current && scrollerRef.current) {
      const stageWidth = stageRef.current.getBoundingClientRect().width;
      // Preserve exactly where the visitor was shopping when they open the
      // full-room map; returning to Explore resumes that same product area.
      if (stageWidth > 0) {
        focusAfterLayout.current = Math.max(0, Math.min(100,
          100 * (scrollerRef.current.scrollLeft + scrollerRef.current.clientWidth / 2) / stageWidth,
        ));
      }
    }
    setOverview((previous) => !previous);
  };

  return (
    <MusicProvider>
      <main className="pupson-boutique relative h-[100dvh] overflow-hidden bg-ink">
        <div
          ref={scrollerRef}
          className="pupson-boutique-viewport h-full w-full overflow-x-auto overflow-y-hidden overscroll-x-contain"
          data-overview={overview}
          data-modal-open={Boolean(activeProduct || cartOpen)}
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          aria-label="PupsonStuff interactive boutique"
          inert={Boolean(activeProduct || cartOpen)}
        >
          <div ref={stageRef} className="pupson-boutique-stage relative shrink-0">
            <BoutiqueImage />

            {/* Photograph, projection and product click targets use one identical
                image-space box in BOTH portrait and landscape. */}
            <div className="pointer-events-none absolute inset-0 z-[2] bg-[radial-gradient(circle_at_50%_35%,rgba(255,226,177,0.08),transparent_48%),linear-gradient(to_bottom,rgba(255,230,190,0.025),rgba(16,12,8,0.06))]" />
            <BoutiquePersonalizationOverlay previewUrl={latestArtwork?.previewUrl} />
            <Hotspots onSelect={selectProduct} paused={!!activeProduct || cartOpen} />
          </div>
        </div>

        <button
          type="button"
          className="pupson-mobile-view-toggle fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 rounded-full border border-cream/25 bg-ink/85 px-4 py-3 text-xs font-semibold text-cream shadow-xl backdrop-blur"
          onClick={toggleOverview}
          aria-pressed={overview}
          aria-label={overview ? 'Explore boutique up close' : 'Show entire boutique'}
        >
          {overview ? 'Explore room ↔' : 'View whole room'}
        </button>
        {!overview && (
          <div className="pupson-mobile-pan-hint pointer-events-none fixed left-3 top-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] z-20 rounded-full bg-ink/75 px-3 py-1.5 text-[11px] text-cream/85">
            Swipe left or right to browse
          </div>
        )}

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
