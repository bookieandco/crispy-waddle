"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "@/context/CartContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

const centsToPrice = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function CartDrawer({ open, onClose }: Props) {
  const { items, removeItem, updateQuantity, totalCents } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCheckoutError(
          data?.error ?? "Something went wrong starting checkout. Please try again."
        );
        setCheckingOut(false);
        return;
      }
      // Real Stripe-hosted Checkout page — a full navigation, not a
      // client-side route, so no loading-state cleanup needed after
      // this: the page is about to leave.
      window.location.href = data.url;
    } catch {
      setCheckoutError("Couldn't reach checkout. Please try again in a moment.");
      setCheckingOut(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-cream/95 text-ink shadow-2xl backdrop-blur-md"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex items-center justify-between border-b border-greige/40 px-6 py-5">
              <h2 className="font-display text-lg text-bronze">Your Cart</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-ink/60 transition hover:text-ink"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {items.length === 0 ? (
                <div className="rounded-lg border border-greige/40 bg-white/40 p-6 text-center text-sm text-ink/60">
                  Your cart is empty. Generate a preview on any product and
                  add it here.
                </div>
              ) : (
                <ul className="space-y-4">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex gap-3 rounded-lg border border-greige/40 bg-white/40 p-3"
                    >
                      {item.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.previewUrl}
                          alt={item.productName}
                          className="h-16 w-16 flex-shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-16 w-16 flex-shrink-0 rounded-md bg-greige/30" />
                      )}

                      <div className="flex flex-1 flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-ink">
                            {item.productName}
                          </p>
                          <button
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove ${item.productName}`}
                            className="text-xs text-ink/40 transition hover:text-ink"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center rounded-md border border-greige/50">
                            <button
                              onClick={() =>
                                updateQuantity(item.id, item.quantity - 1)
                              }
                              disabled={item.quantity <= 1}
                              className="px-2 py-0.5 text-ink/70 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              –
                            </button>
                            <span className="w-6 text-center text-xs">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(item.id, item.quantity + 1)
                              }
                              className="px-2 py-0.5 text-ink/70 hover:text-ink"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-sm font-medium text-ink">
                            {centsToPrice(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {checkoutError && (
                <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  {checkoutError}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <footer className="border-t border-greige/40 px-6 py-5">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-ink/60">Subtotal</span>
                  <span className="font-semibold text-ink">
                    {centsToPrice(totalCents)}
                  </span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={checkingOut}
                  className="w-full rounded-md bg-honey-oak py-3 text-sm font-semibold text-cream transition hover:bg-bronze disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkingOut ? "Starting checkout…" : "Checkout"}
                </button>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
