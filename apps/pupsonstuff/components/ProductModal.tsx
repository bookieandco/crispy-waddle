"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { ActiveProduct, ArtStyle, artStyles } from "@/types/boutique";
import { useMusic } from "@/context/MusicContext";
import { getProduct3DConfig } from "@/config/product3dModels";
import { screenshotPlugin } from "./product3d-plugins/screenshotPlugin";

// three.js/@react-three/fiber need the browser (WebGL), so this can't be
// server-rendered. Only loaded at all for hotspots that map to a
// registered 3D model below.
const Product3DEngine = dynamic(() => import("./Product3DEngine"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-square items-center justify-center rounded-lg border border-greige/40 bg-white/40 text-xs text-ink/50">
      Loading 3D preview…
    </div>
  ),
});

// Which hotspot maps to which registered 3D model (config/product3dModels.ts)
// and which of that model's print areas the generated portrait goes on.
// Add an entry here when a hotspot's product gets a real .glb — nothing
// else in this file needs to change.
const HOTSPOT_3D_MODEL: Record<string, { modelId: string; printArea: string; color?: string }> = {
  concertShirt: { modelId: "shirt", printArea: "front", color: "#111111" },
  foldedShirts: { modelId: "shirt", printArea: "front", color: "#f4f4f4" },
  whiteHoodie: { modelId: "hoodie", printArea: "front", color: "#f4f4f4" },
  hoodieRight: { modelId: "hoodie", printArea: "front", color: "#111111" },
  pillow: { modelId: "pillow", printArea: "front" },
  mugColorful: { modelId: "mug", printArea: "front" },
  mugWhite: { modelId: "mug", printArea: "front", color: "#f4f4f0" },
};

interface Props {
  activeProduct: ActiveProduct | null;
  onClose: () => void;
}

const centsToPrice = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function ProductModal({ activeProduct, onClose }: Props) {
  const { duck } = useMusic();
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle>("watercolor");
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const open = !!activeProduct;
  const variants = activeProduct?.fulfillment?.variants ?? [];
  const activeVariant =
    variants.find((v) => v.variantId === selectedVariant) ?? variants[0];

  const [generateError, setGenerateError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [view3D, setView3D] = useState(false);

  const threeDMapping = activeProduct ? HOTSPOT_3D_MODEL[activeProduct.id] : undefined;
  const threeDConfig = threeDMapping ? getProduct3DConfig(threeDMapping.modelId) : null;
  const supports3D = !!threeDConfig;

  // Duck the music for as long as the panel is open (spec: "duck while
  // AI is generating artwork or when a modal is open"), reset local state
  // for the new product each time a different hotspot is clicked.
  useEffect(() => {
    if (!open) return;
    duck(true);
    setSelectedVariant(variants[0]?.variantId ?? null);
    setQuantity(1);
    setUploadedFile(null);
    setPreviewUrl(null);
    setGenerateError(null);
    setApproved(false);
    setView3D(false);
    return () => duck(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeProduct?.id]);

  // Calls the real /api/generate-preview route (see
  // app/api/generate-preview/route.ts and lib/ai.ts). This will fail until
  // OPENAI_API_KEY is set in your environment — that's expected, and the
  // error below will say so rather than silently faking a result.
  const handleGeneratePreview = async () => {
    if (!uploadedFile || !activeProduct) return;
    setGenerating(true);
    setGenerateError(null);
    setApproved(false);
    duck(true); // extra duck request stacks with the "modal open" one; music
    // stays ducked as long as either condition holds, and un-ducks only
    // once both clear.

    const styleLabel =
      artStyles.find((s) => s.id === selectedStyle)?.label ?? selectedStyle;

    try {
      const form = new FormData();
      form.append("photo", uploadedFile);
      form.append("productId", activeProduct.id);
      form.append("artStyle", styleLabel);

      const res = await fetch("/api/generate-preview", {
        method: "POST",
        body: form,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setGenerateError(
          data?.error ??
            "Something went wrong generating your portrait. Please try again."
        );
      } else {
        setPreviewUrl(`data:image/png;base64,${data.imageBase64}`);
      }
    } catch {
      setGenerateError(
        "Couldn't reach the AI service. Please try again in a moment."
      );
    } finally {
      setGenerating(false);
      duck(false);
    }
  };

  const isCustomizable = !!activeProduct?.fulfillment;

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
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-cream/95 text-ink shadow-2xl backdrop-blur-md"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex items-center justify-between border-b border-greige/40 px-6 py-5">
              <h2 className="font-display text-lg text-bronze">
                {activeProduct.name}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-ink/60 transition hover:text-ink"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {!isCustomizable ? (
                <div className="rounded-lg border border-greige/40 bg-white/40 p-6 text-center text-sm text-ink/60">
                  {activeProduct.product === "checkout"
                    ? "Checkout isn't wired up yet — this is where the cart drawer opens in the next pass."
                    : "This area doesn't have a fixed product — it's the entry point into the AI uploader."}
                </div>
              ) : (
                <>
                  {/* Product preview */}
                  {supports3D && (
                    <div className="mb-3 flex gap-2">
                      <button
                        onClick={() => setView3D(false)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          !view3D
                            ? "bg-bronze text-cream"
                            : "border border-greige/50 text-ink/60"
                        }`}
                      >
                        Flat Preview
                      </button>
                      <button
                        onClick={() => setView3D(true)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          view3D
                            ? "bg-bronze text-cream"
                            : "border border-greige/50 text-ink/60"
                        }`}
                      >
                        View in 3D
                      </button>
                    </div>
                  )}

                  {supports3D && view3D && threeDConfig && threeDMapping ? (
                    <div className="mb-6">
                      <Product3DEngine
                        config={threeDConfig}
                        color={threeDMapping.color}
                        decals={{ [threeDMapping.printArea]: previewUrl }}
                        plugins={[screenshotPlugin]}
                      />
                    </div>
                  ) : (
                    <div className="mb-6 flex aspect-square items-center justify-center rounded-lg border border-greige/40 bg-white/40">
                      {previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewUrl}
                          alt="Generated preview"
                          className="h-full w-full rounded-lg object-cover"
                        />
                      ) : (
                        <span className="px-6 text-center text-sm text-ink/50">
                          Upload a photo and generate a preview to see it here
                        </span>
                      )}
                    </div>
                  )}

                  {activeVariant && (
                    <div className="mb-2 text-lg font-semibold text-bronze">
                      {centsToPrice(activeVariant.priceCents)}
                    </div>
                  )}

                  {activeProduct.description && (
                    <p className="mb-2 text-sm text-ink/70">
                      {activeProduct.description}
                    </p>
                  )}

                  {activeProduct.estimatedDeliveryDays && (
                    <p className="mb-6 text-xs text-ink/50">
                      Estimated delivery: {activeProduct.estimatedDeliveryDays[0]}–
                      {activeProduct.estimatedDeliveryDays[1]} business days
                    </p>
                  )}

                  {/* Upload */}
                  <label className="mb-6 block">
                    <span className="mb-2 block text-sm font-medium text-bronze">
                      Upload pet photo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setUploadedFile(e.target.files?.[0] ?? null)
                      }
                      className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-honey-oak file:px-4 file:py-2 file:text-sm file:font-medium file:text-cream hover:file:bg-bronze"
                    />
                  </label>

                  {/* Art style */}
                  <div className="mb-6">
                    <span className="mb-2 block text-sm font-medium text-bronze">
                      Art style
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {artStyles.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setSelectedStyle(style.id)}
                          className={`rounded-md border px-3 py-2 text-sm transition ${
                            selectedStyle === style.id
                              ? "border-honey-oak bg-honey-oak text-cream"
                              : "border-greige/50 text-ink/70 hover:border-honey-oak"
                          }`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Variant (size/color from Printful mapping) */}
                  {variants.length > 0 && (
                    <div className="mb-6">
                      <span className="mb-2 block text-sm font-medium text-bronze">
                        {activeProduct.customization?.sizes
                          ? "Size"
                          : "Option"}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {variants.map((v) => (
                          <button
                            key={v.variantId}
                            onClick={() => setSelectedVariant(v.variantId)}
                            className={`rounded-md border px-3 py-2 text-sm transition ${
                              activeVariant?.variantId === v.variantId
                                ? "border-honey-oak bg-honey-oak text-cream"
                                : "border-greige/50 text-ink/70 hover:border-honey-oak"
                            }`}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quantity */}
                  <div className="mb-6 flex items-center gap-3">
                    <span className="text-sm font-medium text-bronze">
                      Quantity
                    </span>
                    <div className="flex items-center rounded-md border border-greige/50">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="px-3 py-1 text-ink/70 hover:text-ink"
                      >
                        –
                      </button>
                      <span className="w-8 text-center text-sm">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity((q) => q + 1)}
                        className="px-3 py-1 text-ink/70 hover:text-ink"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {generateError && (
                    <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                      <p className="mb-1">{generateError}</p>
                      <button
                        onClick={handleGeneratePreview}
                        className="font-medium underline underline-offset-2"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!previewUrl ? (
                    <button
                      onClick={handleGeneratePreview}
                      disabled={!uploadedFile || generating}
                      className="mb-3 w-full rounded-md bg-bronze py-3 text-sm font-medium text-cream transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {generating ? "Generating…" : "Generate Preview"}
                    </button>
                  ) : (
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={handleGeneratePreview}
                        disabled={generating}
                        className="rounded-md border border-honey-oak py-3 text-sm font-medium text-bronze transition hover:bg-honey-oak hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {generating ? "Generating…" : "Generate Again"}
                      </button>
                      <button
                        onClick={() => setApproved(true)}
                        disabled={generating || approved}
                        className={`rounded-md py-3 text-sm font-medium transition disabled:cursor-not-allowed ${
                          approved
                            ? "bg-honey-oak text-cream opacity-70"
                            : "bg-bronze text-cream hover:bg-ink"
                        }`}
                      >
                        {approved ? "Approved ✓" : "Approve"}
                      </button>
                    </div>
                  )}

                  {previewUrl && (
                    <button className="mb-3 w-full rounded-md border border-honey-oak py-3 text-sm font-medium text-bronze transition hover:bg-honey-oak hover:text-cream">
                      See It in the Boutique
                    </button>
                  )}
                </>
              )}
            </div>

            {isCustomizable && (
              <footer className="border-t border-greige/40 px-6 py-5">
                <button
                  disabled={!approved}
                  className="w-full rounded-md bg-honey-oak py-3 text-sm font-semibold text-cream transition hover:bg-bronze disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add to Cart
                  {activeVariant &&
                    ` — ${centsToPrice(activeVariant.priceCents * quantity)}`}
                </button>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
