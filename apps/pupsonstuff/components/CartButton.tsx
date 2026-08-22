"use client";

import { useCart } from "@/context/CartContext";

interface Props {
  onClick: () => void;
}

// Bottom-right is MusicToggle's spot, bottom-left is the 3D/Photo View
// mode toggle (both in Boutique.tsx) — top-right is the one corner
// neither of those already claims, and it's the conventional spot for a
// cart control anyway.
export default function CartButton({ onClick }: Props) {
  const { itemCount } = useCart();

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open cart${itemCount > 0 ? `, ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}`}
      className="fixed right-5 top-5 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-ink/80 text-cream shadow-lg backdrop-blur transition hover:bg-ink"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {itemCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-ink">
          {itemCount}
        </span>
      )}
    </button>
  );
}
