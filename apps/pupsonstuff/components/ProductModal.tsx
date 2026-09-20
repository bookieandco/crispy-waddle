"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { ActiveProduct, ArtStyle, artStyles } from "@/types/boutique";
import { useMusic } from "@/context/MusicContext";
import { getProduct3DConfig } from "@/config/product3dModels";
import { screenshotPlugin } from "./product3d-plugins/screenshotPlugin";
import AsciiSpinner from "./AsciiSpinner";
import PetIdentityUploader from "./PetIdentityUploader";

const Product3DEngine = dynamic(() => import("./Product3DEngine"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-square items-center justify-center rounded-lg border border-greige/40 bg-white/40 text-xs text-ink/50">
      Loading 3D product…
    </div>
  ),
});

const HOTSPOT_3D_MODEL: Record<string, { modelId: string; printArea: string; color?: string }> = {
  concertShirt: { modelId: "shirt", printArea: "front", color: "#111111" },
  foldedShirts: { modelId: "shirt", printArea: "front", color: "#f4f4f4" },
  whiteHoodie: { modelId: "hoodie", printArea: "front", color: "#f4f4f4" },
  hoodieRight: { modelId: "hoodie", printArea: "front", color: "#111111" },
  pillow: { modelId: "pillow", printArea: "front" },
  mugColorful: { modelId: "mug", printArea: "front" },
  mugWhite: { modelId: "mug", printArea: "front", color: "#f4f4f0" },
  bottle: { modelId: "bottle", printArea: "front" },
  tote: { modelId: "tote", printArea: "front" },
};

interface Props {
  activeProduct: ActiveProduct | null;
  onClose: () => void;
}

interface CreativeOutput {
  id: string;
  assetId: string;
  uri: string;
  signedUrl?: string;
}

const centsToPrice = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function ProductModal({ activeProduct, onClose }: Props) {
  const { duck } = useMusic();
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle>("watercolor");
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [outputs, setOutputs] = useState<CreativeOutput[]>([]);
  const [selectedOutput, setSelectedOutput] = useState<CreativeOutput | null>(null);
  const [approved, setApproved] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [animatedVideoUrl, setAnimatedVideoUrl] = useState<string | null>(null);
  const [animateError, setAnimateError] = useState<string | null>(null);

  const open = !!activeProduct;
  const variants = activeProduct?.fulfillment?.variants ?? [];
  const activeVariant = variants.find((v) => v.variantId === selectedVariant) ?? variants[0];
  const mapping = activeProduct ? HOTSPOT_3D_MODEL[activeProduct.id] : undefined;
  const threeDConfig = mapping ? getProduct3DConfig(mapping.modelId) : null;
  const supports3D = !!threeDConfig;
  const previewUrl = selectedOutput?.signedUrl ?? null;
  const styleLabel = artStyles.find((style) => style.id === selectedStyle)?.label ?? selectedStyle;
  const isCustomizable = !!activeProduct?.fulfillment;

  useEffect(() => {
    if (!open) return;
    duck(true);
    setSelectedVariant(variants[0]?.variantId ?? null);
    setQuantity(1);
    setOutputs([]);
    setSelectedOutput(null);
    setApproved(false);
    setAnimatedVideoUrl(null);
    setAnimateError(null);
    return () => duck(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeProduct?.id]);

  const handleCompleted = (nextOutputs: CreativeOutput[]) => {
    setOutputs(nextOutputs);
    setSelectedOutput(nextOutputs[0] ?? null);
    setApproved(false);
    setAnimatedVideoUrl(null);
    setAnimateError(null);
  };

  const handleAnimatePreview = async () => {
    if (!previewUrl || animating) return;
    setAnimating(true);
    setAnimateError(null);
    duck(true);
    try {
      const response = await fetch("/api/animate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: previewUrl }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error ?? "Animation failed.");
      setAnimatedVideoUrl(`data:${data.mimeType};base64,${data.videoBase64}`);
    } catch (error) {
      setAnimateError(error instanceof Error ? error.message : "Animation failed.");
    } finally {
      setAnimating(false);
      duck(false);
    }
  };

  return (
    <AnimatePresence>
      {open && activeProduct && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col bg-cream/95 text-ink shadow-2xl backdrop-blur-md"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex items-center justify-between border-b border-greige/40 px-6 py-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink/40">Product Studio</p>
                <h2 className="font-display text-xl text-bronze">{activeProduct.name}</h2>
              </div>
              <button onClick={onClose} aria-label="Close" className="text-ink/60 transition hover:text-ink">✕</button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {!isCustomizable ? (
                <div className="rounded-lg border border-greige/40 bg-white/40 p-6 text-center text-sm text-ink/60">
                  This area is the entry point into the AI product studio.
                </div>
              ) : (
                <>
                  <div className="mb-6 overflow-hidden rounded-2xl border border-greige/40 bg-white/30">
                    {supports3D && threeDConfig && mapping && previewUrl ? (
                      <Product3DEngine
                        config={threeDConfig}
                        color={mapping.color}
                        decals={{ [mapping.printArea]: previewUrl }}
                        plugins={[screenshotPlugin]}
                      />
                    ) : previewUrl ? (
                      <div className="aspect-square">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewUrl} alt="Selected pet artwork" className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className="flex aspect-square items-center justify-center px-8 text-center text-sm text-ink/50">
                        Add your pet photos below. Your artwork will appear on the 3D product here.
                      </div>
                    )}
                  </div>

                  {outputs.length > 1 && (
                    <div className="mb-6">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-bronze">Choose your design</span>
                        <span className="text-xs text-ink/40">{outputs.length} generated</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {outputs.map((output, index) => (
                          <button
                            key={output.id}
                            type="button"
                            onClick={() => { setSelectedOutput(output); setApproved(false); }}
                            className={`overflow-hidden rounded-xl border-2 bg-white/40 transition ${selectedOutput?.id === output.id ? "border-honey-oak shadow-lg" : "border-transparent hover:border-greige"}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={output.signedUrl} alt={`Generated design ${index + 1}`} className="aspect-square w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <span className="mb-2 block text-sm font-medium text-bronze">Art style</span>
                    <div className="grid grid-cols-2 gap-2">
                      {artStyles.map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setSelectedStyle(style.id)}
                          className={`rounded-md border px-3 py-2 text-sm transition ${selectedStyle === style.id ? "border-honey-oak bg-honey-oak text-cream" : "border-greige/50 text-ink/70 hover:border-honey-oak"}`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <PetIdentityUploader
                    productId={activeProduct.id}
                    artStyle={styleLabel}
                    onCompleted={handleCompleted}
                  />

                  {activeVariant && (
                    <div className="mb-4 text-lg font-semibold text-bronze">{centsToPrice(activeVariant.priceCents)}</div>
                  )}

                  {activeProduct.description && <p className="mb-2 text-sm text-ink/70">{activeProduct.description}</p>}
                  {activeProduct.estimatedDeliveryDays && (
                    <p className="mb-6 text-xs text-ink/50">
                      Estimated delivery: {activeProduct.estimatedDeliveryDays[0]}–{activeProduct.estimatedDeliveryDays[1]} business days
                    </p>
                  )}

                  {variants.length > 0 && (
                    <div className="mb-6">
                      <span className="mb-2 block text-sm font-medium text-bronze">{activeProduct.customization?.sizes ? "Size" : "Option"}</span>
                      <div className="flex flex-wrap gap-2">
                        {variants.map((variant) => (
                          <button
                            key={variant.variantId}
                            type="button"
                            onClick={() => setSelectedVariant(variant.variantId)}
                            className={`rounded-md border px-3 py-2 text-sm transition ${activeVariant?.variantId === variant.variantId ? "border-honey-oak bg-honey-oak text-cream" : "border-greige/50 text-ink/70 hover:border-honey-oak"}`}
                          >
                            {variant.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-6 flex items-center gap-3">
                    <span className="text-sm font-medium text-bronze">Quantity</span>
                    <div className="flex items-center rounded-md border border-greige/50">
                      <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="px-3 py-1 text-ink/70 hover:text-ink">–</button>
                      <span className="w-8 text-center text-sm">{quantity}</span>
                      <button type="button" onClick={() => setQuantity((value) => value + 1)} className="px-3 py-1 text-ink/70 hover:text-ink">+</button>
                    </div>
                  </div>

                  {animating && <div className="mb-4"><AsciiSpinner label="Animating your pet artwork…" /></div>}
                  {animateError && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{animateError}</p>}
                  {previewUrl && !animating && (
                    <button type="button" onClick={handleAnimatePreview} className="mb-3 w-full rounded-md border border-honey-oak py-3 text-sm font-medium text-bronze transition hover:bg-honey-oak hover:text-cream">
                      {animatedVideoUrl ? "Animate Again" : "Animate Preview"}
                    </button>
                  )}
                  {animatedVideoUrl && (
                    <div className="mb-6 aspect-video overflow-hidden rounded-xl border border-greige/40 bg-black">
                      <video src={animatedVideoUrl} className="h-full w-full object-contain" autoPlay loop muted playsInline controls />
                    </div>
                  )}

                  {previewUrl && (
                    <button
                      type="button"
                      onClick={() => setApproved(true)}
                      disabled={approved}
                      className={`mb-3 w-full rounded-md py-3 text-sm font-semibold transition ${approved ? "bg-honey-oak text-cream" : "bg-bronze text-cream hover:bg-ink"}`}
                    >
                      {approved ? "Design Approved ✓" : "Use This Design"}
                    </button>
                  )}
                </>
              )}
            </div>

            {isCustomizable && (
              <footer className="border-t border-greige/40 px-6 py-5">
                <button
                  disabled={!approved || !selectedOutput}
                  className="w-full rounded-md bg-honey-oak py-3 text-sm font-semibold text-cream transition hover:bg-bronze disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add to Cart{activeVariant ? ` — ${centsToPrice(activeVariant.priceCents * quantity)}` : ""}
                </button>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
