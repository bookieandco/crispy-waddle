"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { ActiveProduct, ArtStyle, artStyles } from "@/types/boutique";
import { useMusic } from "@/context/MusicContext";
import { getProduct3DConfig } from "@/config/product3dModels";
import { screenshotPlugin } from "./product3d-plugins/screenshotPlugin";
import AsciiSpinner from "./AsciiSpinner";

const Product3DEngine = dynamic(() => import("./Product3DEngine"), {
  ssr: false,
  loading: () => <div className="flex aspect-square items-center justify-center rounded-2xl border border-greige/40 bg-white/40 text-xs text-ink/50">Loading 3D preview…</div>,
});

const HOTSPOT_3D_MODEL: Record<string, { modelId: string; printArea: string; color?: string }> = {
  concertShirt: { modelId: "shirt", printArea: "front", color: "#111111" }, foldedShirts: { modelId: "shirt", printArea: "front", color: "#f4f4f4" }, whiteHoodie: { modelId: "hoodie", printArea: "front", color: "#f4f4f4" }, hoodieRight: { modelId: "hoodie", printArea: "front", color: "#111111" }, pillow: { modelId: "pillow", printArea: "front" }, mugColorful: { modelId: "mug", printArea: "front" }, mugWhite: { modelId: "mug", printArea: "front", color: "#f4f4f0" }, bottle: { modelId: "bottle", printArea: "front" }, tote: { modelId: "tote", printArea: "front" },
};

interface Props { activeProduct: ActiveProduct | null; onClose: () => void; }
const centsToPrice = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function ProductModal({ activeProduct, onClose }: Props) {
  const { duck } = useMusic();
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle>("watercolor");
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [viewMode, setViewMode] = useState<"flat" | "3d" | "animated">("flat");
  const [animating, setAnimating] = useState(false);
  const [animatedVideoUrl, setAnimatedVideoUrl] = useState<string | null>(null);
  const [animateError, setAnimateError] = useState<string | null>(null);

  const open = !!activeProduct;
  const variants = activeProduct?.fulfillment?.variants ?? [];
  const activeVariant = variants.find((v) => v.variantId === selectedVariant) ?? variants[0];
  const threeDMapping = activeProduct ? HOTSPOT_3D_MODEL[activeProduct.id] : undefined;
  const threeDConfig = threeDMapping ? getProduct3DConfig(threeDMapping.modelId) : null;
  const supports3D = !!threeDConfig;
  const isCustomizable = !!activeProduct?.fulfillment;

  useEffect(() => {
    if (!open) return;
    duck(true);
    setSelectedVariant(variants[0]?.variantId ?? null);
    setQuantity(1); setUploadedFile(null); setPreviewUrl(null); setGenerateError(null); setApproved(false); setViewMode("flat"); setAnimatedVideoUrl(null); setAnimateError(null);
    return () => duck(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeProduct?.id]);

  useEffect(() => {
    if (!open || !activeProduct) return;
    window.dispatchEvent(new CustomEvent("pupsonstuff:product-select", { detail: { productId: activeProduct.name } }));
  }, [open, activeProduct]);

  const handleGeneratePreview = async () => {
    if (!uploadedFile || !activeProduct) return;
    setGenerating(true); setGenerateError(null); setApproved(false); setAnimatedVideoUrl(null); setAnimateError(null); setViewMode("flat"); duck(true);
    const styleLabel = artStyles.find((s) => s.id === selectedStyle)?.label ?? selectedStyle;
    try {
      const form = new FormData(); form.append("photo", uploadedFile); form.append("productId", activeProduct.id); form.append("artStyle", styleLabel); form.append("artStyleId", selectedStyle);
      const res = await fetch("/api/generate-preview", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.success) setGenerateError(data?.error ?? "Something went wrong generating your portrait. Please try again.");
      else setPreviewUrl(`data:image/png;base64,${data.imageBase64}`);
    } catch { setGenerateError("Couldn't reach the AI service. Please try again in a moment."); }
    finally { setGenerating(false); duck(false); }
  };

  const handleAnimatePreview = async () => {
    if (!previewUrl) return;
    setAnimating(true); setAnimateError(null); duck(true);
    try {
      const res = await fetch("/api/animate-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: previewUrl }) });
      const data = await res.json();
      if (!res.ok || !data.success) setAnimateError(data?.error ?? "Something went wrong animating your portrait. Please try again.");
      else { setAnimatedVideoUrl(`data:${data.mimeType};base64,${data.videoBase64}`); setViewMode("animated"); }
    } catch { setAnimateError("Couldn't reach the animation service. Please try again in a moment."); }
    finally { setAnimating(false); duck(false); }
  };

  return (
    <AnimatePresence>
      {open && activeProduct && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-ink/65 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className="fixed inset-x-2 bottom-2 top-12 z-50 flex w-auto flex-col overflow-hidden rounded-[2rem] border border-cream/20 bg-cream/95 text-ink shadow-2xl backdrop-blur-md sm:inset-y-0 sm:right-0 sm:left-auto sm:top-0 sm:bottom-0 sm:w-full sm:max-w-md sm:rounded-none"
            initial={{ y: "100%", x: 0, scale: 0.97 }}
            animate={{ y: 0, x: 0, scale: 1 }}
            exit={{ y: "100%", scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-greige/40 px-5 py-4 sm:px-6 sm:py-5">
              <div><p className="text-[9px] uppercase tracking-[0.24em] text-bronze/60">PupsonStuff custom studio</p><h2 className="font-display text-lg text-bronze">{activeProduct.name}</h2></div>
              <button onClick={onClose} aria-label="Close" className="rounded-full border border-greige/40 px-3 py-2 text-ink/60 transition hover:text-ink">✕</button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
              {!isCustomizable ? (
                <div className="rounded-2xl border border-greige/40 bg-white/40 p-6 text-center text-sm text-ink/60">{activeProduct.product === "checkout" ? "Checkout isn't wired up yet — this is where the cart drawer opens in the next pass." : "This area doesn't have a fixed product — it's the entry point into the AI uploader."}</div>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button onClick={() => setViewMode("flat")} className={`rounded-full px-3 py-1 text-xs font-medium ${viewMode === "flat" ? "bg-bronze text-cream" : "border border-greige/50 text-ink/60"}`}>Flat</button>
                    {supports3D && <button onClick={() => setViewMode("3d")} className={`rounded-full px-3 py-1 text-xs font-medium ${viewMode === "3d" ? "bg-bronze text-cream" : "border border-greige/50 text-ink/60"}`}>3D</button>}
                    {animatedVideoUrl && <button onClick={() => setViewMode("animated")} className={`rounded-full px-3 py-1 text-xs font-medium ${viewMode === "animated" ? "bg-bronze text-cream" : "border border-greige/50 text-ink/60"}`}>Animated</button>}
                  </div>

                  <div className="mb-5 flex min-h-[45vh] items-center justify-center overflow-hidden rounded-[1.5rem] border border-greige/40 bg-white/45 shadow-inner sm:aspect-square sm:min-h-0">
                    {generating || animating ? <AsciiSpinner label={generating ? "Generating your portrait…" : "Animating your portrait…"} /> : viewMode === "3d" && supports3D && threeDConfig && threeDMapping ? <Product3DEngine config={threeDConfig} color={threeDMapping.color} decals={{ [threeDMapping.printArea]: previewUrl }} plugins={[screenshotPlugin]} /> : viewMode === "animated" && animatedVideoUrl ? <video src={animatedVideoUrl} className="h-full w-full object-contain" autoPlay loop muted playsInline controls /> : previewUrl ? <img src={previewUrl} alt="Your generated pet artwork on the selected product" className="h-full w-full object-contain p-3" /> : <div className="px-8 text-center text-sm text-ink/50">Upload your pet photo, choose a style, and generate a preview. Your artwork will appear here.</div>}
                  </div>

                  {activeVariant && <div className="mb-1 text-lg font-semibold text-bronze">{centsToPrice(activeVariant.priceCents)}</div>}
                  {activeProduct.description && <p className="mb-4 text-sm text-ink/70">{activeProduct.description}</p>}

                  <label className="mb-5 block"><span className="mb-2 block text-sm font-medium text-bronze">Upload pet photo</span><input type="file" accept="image/*" onChange={(e) => setUploadedFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-honey-oak file:px-4 file:py-2 file:text-sm file:font-medium file:text-cream hover:file:bg-bronze" /></label>

                  <div className="mb-5"><span className="mb-2 block text-sm font-medium text-bronze">Art style</span><div className="flex gap-2 overflow-x-auto pb-1">{artStyles.map((style) => <button key={style.id} onClick={() => setSelectedStyle(style.id)} className={`shrink-0 rounded-full border px-3 py-2 text-xs transition ${selectedStyle === style.id ? "border-honey-oak bg-honey-oak text-cream" : "border-greige/50 text-ink/70"}`}>{style.label}</button>)}</div></div>

                  {variants.length > 0 && <div className="mb-5"><span className="mb-2 block text-sm font-medium text-bronze">{activeProduct.customization?.sizes ? "Size" : "Option"}</span><div className="flex flex-wrap gap-2">{variants.map((variant) => <button key={variant.variantId} onClick={() => setSelectedVariant(variant.variantId)} className={`rounded-full border px-3 py-2 text-xs ${selectedVariant === variant.variantId ? "border-honey-oak bg-honey-oak text-cream" : "border-greige/50 text-ink/70"}`}>{variant.name}</button>)}</div></div>}

                  {generateError && <p className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{generateError}</p>}
                  {animateError && <p className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{animateError}</p>}

                  <div className="grid grid-cols-2 gap-2 pb-4">
                    <button type="button" disabled={!uploadedFile || generating} onClick={handleGeneratePreview} className="rounded-xl bg-honey-oak px-4 py-3 text-sm font-semibold text-cream disabled:cursor-not-allowed disabled:opacity-40">{generating ? "Generating…" : previewUrl ? "Regenerate" : "Generate Preview"}</button>
                    <button type="button" disabled={!previewUrl || animating} onClick={handleAnimatePreview} className="rounded-xl border border-bronze/30 px-4 py-3 text-sm font-semibold text-bronze disabled:cursor-not-allowed disabled:opacity-40">{animating ? "Animating…" : "Animate Art"}</button>
                  </div>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
