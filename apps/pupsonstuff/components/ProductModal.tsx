'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { ActiveProduct, ArtStyle, artStyles } from '@/types/boutique';
import {
  DEFAULT_ARTWORK_TRANSFORM,
  type ArtworkTransform,
  type BackgroundMode,
} from '@/types/creative';
import { useMusic } from '@/context/MusicContext';
import { useCart } from '@/context/CartContext';
import { getProduct3DConfig } from '@/config/product3dModels';
import { screenshotPlugin } from './product3d-plugins/screenshotPlugin';
import AsciiSpinner from './AsciiSpinner';
import ArtworkEditor from './ArtworkEditor';

// three.js/@react-three/fiber need the browser (WebGL), so this can't be
// server-rendered. Only loaded at all for hotspots that map to a
// registered 3D model below.
const Product3DEngine = dynamic(() => import('./Product3DEngine'), {
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
  concertShirt: { modelId: 'shirt', printArea: 'front', color: '#111111' },
  foldedShirts: { modelId: 'shirt', printArea: 'front', color: '#f4f4f4' },
  whiteHoodie: { modelId: 'hoodie', printArea: 'front', color: '#f4f4f4' },
  hoodieRight: { modelId: 'hoodie', printArea: 'front', color: '#111111' },
  pillow: { modelId: 'pillow', printArea: 'front' },
  mugColorful: { modelId: 'mug', printArea: 'front' },
  mugWhite: { modelId: 'mug', printArea: 'front', color: '#f4f4f0' },
  bottle: { modelId: 'bottle', printArea: 'front' },
  tote: { modelId: 'tote', printArea: 'front' },
};

interface Props {
  activeProduct: ActiveProduct | null;
  onClose: () => void;
}

const centsToPrice = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function ProductModal({ activeProduct, onClose }: Props) {
  const { duck } = useMusic();
  const { addItem } = useCart();
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle>('watercolor');
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [petName, setPetName] = useState('My Pet');
  const [prompt, setPrompt] = useState('');
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('auto');
  const [artworkTransform, setArtworkTransform] = useState<ArtworkTransform>({
    ...DEFAULT_ARTWORK_TRANSFORM,
  });
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const open = !!activeProduct;
  const variants = activeProduct?.fulfillment?.variants ?? [];
  const activeVariant = variants.find((v) => v.variantId === selectedVariant) ?? variants[0];

  const [generateError, setGenerateError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [creativeOutputId, setCreativeOutputId] = useState<string | null>(null);

  // "animated" only becomes reachable once animatedVideoUrl exists — see
  // the segmented control below. Kept as one viewMode rather than a
  // separate boolean per view so switching to one always switches away
  // from the others, instead of needing to remember to clear view3D
  // whenever an animated view is added later (which is exactly what
  // happened here — this replaces the old standalone view3D boolean).
  const [viewMode, setViewMode] = useState<'flat' | '3d' | 'animated'>('3d');
  const [animating, setAnimating] = useState(false);
  const [animatedVideoUrl, setAnimatedVideoUrl] = useState<string | null>(null);
  const [animateError, setAnimateError] = useState<string | null>(null);

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
    setUploadedFiles([]);
    setPrompt('');
    setBackgroundMode('auto');
    setArtworkTransform({ ...DEFAULT_ARTWORK_TRANSFORM });
    setPreviewUrl(null);
    setGenerateError(null);
    setApproved(false);
    setCreativeOutputId(null);
    setViewMode(supports3D ? '3d' : 'flat');
    setAnimatedVideoUrl(null);
    setAnimateError(null);
    return () => duck(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeProduct?.id, supports3D]);

  const waitForCreativeJob = async (jobId: string) => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const response = await fetch(`/api/creative/jobs/${jobId}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error ?? 'Could not read the creative job.');
      if (body.job.status === 'succeeded' && body.job.previewUrl && body.job.outputId) {
        return body.job as { previewUrl: string; outputId: string };
      }
      if (body.job.status === 'failed' || body.job.status === 'cancelled') {
        throw new Error(body.job.error ?? 'Creative job did not complete.');
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    throw new Error('Creative job is still processing. Please try again shortly.');
  };

  const handleGeneratePreview = async () => {
    if (uploadedFiles.length === 0 || !activeProduct) return;
    setGenerating(true);
    setGenerateError(null);
    setApproved(false);
    // A fresh static generation invalidates any earlier animation — it
    // was made from the previous image, not this one.
    setAnimatedVideoUrl(null);
    setAnimateError(null);
    if (viewMode === 'animated') setViewMode('flat');
    duck(true); // extra duck request stacks with the "modal open" one; music
    // stays ducked as long as either condition holds, and un-ducks only
    // once both clear.

    try {
      const form = new FormData();
      uploadedFiles.forEach((file) => form.append('photos', file));
      form.append('petName', petName);
      form.append('productId', activeProduct.id);
      form.append('artStyleId', selectedStyle);
      form.append('prompt', prompt);
      form.append('backgroundMode', backgroundMode);
      form.append('consent', 'true');

      const res = await fetch('/api/creative/jobs', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: form,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setGenerateError(
          data?.error ?? 'Something went wrong generating your portrait. Please try again.'
        );
      } else {
        const job = await waitForCreativeJob(data.jobId);
        setPreviewUrl(job.previewUrl);
        setCreativeOutputId(job.outputId);
        setArtworkTransform({ ...DEFAULT_ARTWORK_TRANSFORM });
        setViewMode(supports3D ? '3d' : 'flat');
      }
    } catch (error) {
      setGenerateError(
        error instanceof Error
          ? error.message
          : "Couldn't reach the creative service. Please try again in a moment."
      );
    } finally {
      setGenerating(false);
      duck(false);
    }
  };

  const handleApprove = async () => {
    if (!creativeOutputId) return;
    if (!activeVariant) return;
    const response = await fetch(`/api/creative/outputs/${creativeOutputId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variantId: activeVariant.variantId,
        transform: artworkTransform,
      }),
    });
    const body = await response.json();
    if (!response.ok || !body.success) {
      setGenerateError(body.error ?? 'Could not approve this artwork.');
      return;
    }
    setApproved(true);
  };

  const handleAddToCart = () => {
    if (!activeProduct || !activeVariant || !creativeOutputId || !approved) return;
    const styleLabel =
      artStyles.find((style) => style.id === selectedStyle)?.label ?? selectedStyle;
    addItem({
      productId: activeProduct.id,
      variantId: activeVariant.variantId,
      productName: `${activeProduct.name} — ${activeVariant.label} — ${styleLabel}`,
      price: activeVariant.priceCents,
      quantity,
      previewUrl: previewUrl ?? undefined,
      artStyle: selectedStyle,
      creativeOutputId,
    });
    onClose();
  };

  // Calls the real /api/animate-preview route (see
  // app/api/animate-preview/route.ts and lib/animation.ts — Hugging Face's
  // image-to-video task). Takes the already-generated static portrait, not
  // a fresh upload; fails until HUGGINGFACE_API_KEY is set, same honest
  // failure pattern as handleGeneratePreview above.
  const handleAnimatePreview = async () => {
    if (!previewUrl) return;
    setAnimating(true);
    setAnimateError(null);
    duck(true);

    try {
      const res = await fetch('/api/animate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: previewUrl }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setAnimateError(
          data?.error ?? 'Something went wrong animating your portrait. Please try again.'
        );
      } else {
        setAnimatedVideoUrl(`data:${data.mimeType};base64,${data.videoBase64}`);
        setViewMode('animated');
      }
    } catch {
      setAnimateError("Couldn't reach the animation service. Please try again in a moment.");
    } finally {
      setAnimating(false);
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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="flex items-center justify-between border-b border-greige/40 px-6 py-5">
              <h2 className="font-display text-lg text-bronze">{activeProduct.name}</h2>
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
                  {activeProduct.product === 'checkout'
                    ? 'Open the cart to review your approved products and continue to checkout.'
                    : "This area doesn't have a fixed product — it's the entry point into the AI uploader."}
                </div>
              ) : (
                <>
                  {/* Product preview: 3D is the default whenever a real model exists. */}
                  {animatedVideoUrl && (
                    <div className="mb-3 flex gap-2">
                      <button
                        onClick={() => setViewMode(supports3D ? '3d' : 'flat')}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          viewMode !== 'animated'
                            ? 'bg-bronze text-cream'
                            : 'border border-greige/50 text-ink/60'
                        }`}
                      >
                        Product
                      </button>
                      <button
                        onClick={() => setViewMode('animated')}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          viewMode === 'animated'
                            ? 'bg-bronze text-cream'
                            : 'border border-greige/50 text-ink/60'
                        }`}
                      >
                        Animated
                      </button>
                    </div>
                  )}

                  {generating || animating ? (
                    <div className="mb-6 aspect-square overflow-hidden rounded-lg border border-greige/40">
                      <AsciiSpinner
                        label={
                          generating ? 'Generating your portrait…' : 'Animating your portrait…'
                        }
                      />
                    </div>
                  ) : viewMode !== 'animated' && supports3D && threeDConfig && threeDMapping ? (
                    <div className="mb-6">
                      <Product3DEngine
                        config={threeDConfig}
                        color={threeDMapping.color}
                        decals={{ [threeDMapping.printArea]: previewUrl }}
                        decalTransforms={{ [threeDMapping.printArea]: artworkTransform }}
                        plugins={[screenshotPlugin]}
                      />
                    </div>
                  ) : viewMode === 'animated' && animatedVideoUrl ? (
                    <div className="mb-6 aspect-square overflow-hidden rounded-lg border border-greige/40 bg-white/40">
                      <video
                        src={animatedVideoUrl}
                        className="h-full w-full object-cover"
                        autoPlay
                        loop
                        muted
                        playsInline
                        controls
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
                    <p className="mb-2 text-sm text-ink/70">{activeProduct.description}</p>
                  )}

                  {activeProduct.estimatedDeliveryDays && (
                    <p className="mb-6 text-xs text-ink/50">
                      Estimated delivery: {activeProduct.estimatedDeliveryDays[0]}–
                      {activeProduct.estimatedDeliveryDays[1]} business days
                    </p>
                  )}

                  <label className="mb-3 block">
                    <span className="mb-2 block text-sm font-medium text-bronze">Pet name</span>
                    <input
                      value={petName}
                      onChange={(event) => setPetName(event.target.value)}
                      maxLength={80}
                      className="w-full rounded-md border border-greige/50 bg-white/70 px-3 py-2 text-sm"
                    />
                  </label>

                  {/* Upload */}
                  <label className="mb-4 block">
                    <span className="mb-1 block text-sm font-medium text-bronze">
                      Pet reference photos
                    </span>
                    <span className="mb-2 block text-xs text-ink/50">
                      One strong photo is enough. Add a second or third only when it shows useful markings or another angle.
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) =>
                        setUploadedFiles(Array.from(event.target.files ?? []).slice(0, 3))
                      }
                      className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-honey-oak file:px-4 file:py-2 file:text-sm file:font-medium file:text-cream hover:file:bg-bronze"
                    />
                  </label>

                  <label className="mb-4 block">
                    <span className="mb-2 block text-sm font-medium text-bronze">
                      Describe what you want
                    </span>
                    <textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value.slice(0, 2000))}
                      rows={3}
                      placeholder="Optional — pose, mood, clothing, composition, or background direction."
                      className="w-full resize-none rounded-md border border-greige/50 bg-white/70 px-3 py-2 text-sm"
                    />
                  </label>

                  <div className="mb-6">
                    <span className="mb-2 block text-sm font-medium text-bronze">Photo background</span>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ['auto', 'Remove'],
                        ['keep', 'Keep'],
                        ['generate', 'Generate'],
                      ] as const).map(([mode, label]) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            setBackgroundMode(mode);
                            setApproved(false);
                          }}
                          className={`rounded-md border px-2 py-2 text-xs transition ${
                            backgroundMode === mode
                              ? 'border-honey-oak bg-honey-oak text-cream'
                              : 'border-greige/50 text-ink/70 hover:border-honey-oak'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-ink/45">
                      Remove is the default. Generate keeps the subject but lets your prompt define a new background.
                    </p>
                  </div>

                  {/* Art style */}
                  <div className="mb-6">
                    <span className="mb-2 block text-sm font-medium text-bronze">Art style</span>
                    <div className="grid grid-cols-2 gap-2">
                      {artStyles.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setSelectedStyle(style.id)}
                          className={`rounded-md border px-3 py-2 text-sm transition ${
                            selectedStyle === style.id
                              ? 'border-honey-oak bg-honey-oak text-cream'
                              : 'border-greige/50 text-ink/70 hover:border-honey-oak'
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
                        {activeProduct.customization?.sizes ? 'Size' : 'Option'}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {variants.map((v) => (
                          <button
                            key={v.variantId}
                            onClick={() => {
                              setSelectedVariant(v.variantId);
                              setApproved(false);
                            }}
                            className={`rounded-md border px-3 py-2 text-sm transition ${
                              activeVariant?.variantId === v.variantId
                                ? 'border-honey-oak bg-honey-oak text-cream'
                                : 'border-greige/50 text-ink/70 hover:border-honey-oak'
                            }`}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {previewUrl && (
                    <div className="mb-6">
                      <span className="mb-2 block text-sm font-medium text-bronze">
                        Place your artwork
                      </span>
                      <ArtworkEditor
                        imageUrl={previewUrl}
                        transform={artworkTransform}
                        onTransformChange={(next) => {
                          setArtworkTransform(next);
                          setApproved(false);
                        }}
                      />
                    </div>
                  )}

                                    {/* Quantity */}
                  <div className="mb-6 flex items-center gap-3">
                    <span className="text-sm font-medium text-bronze">Quantity</span>
                    <div className="flex items-center rounded-md border border-greige/50">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="px-3 py-1 text-ink/70 hover:text-ink"
                      >
                        –
                      </button>
                      <span className="w-8 text-center text-sm">{quantity}</span>
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
                      disabled={uploadedFiles.length === 0 || generating}
                      className="mb-3 w-full rounded-md bg-bronze py-3 text-sm font-medium text-cream transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {generating ? 'Generating…' : 'Generate Preview'}
                    </button>
                  ) : (
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={handleGeneratePreview}
                        disabled={generating}
                        className="rounded-md border border-honey-oak py-3 text-sm font-medium text-bronze transition hover:bg-honey-oak hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {generating ? 'Generating…' : 'Generate Again'}
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={generating || approved}
                        className={`rounded-md py-3 text-sm font-medium transition disabled:cursor-not-allowed ${
                          approved
                            ? 'bg-honey-oak text-cream opacity-70'
                            : 'bg-bronze text-cream hover:bg-ink'
                        }`}
                      >
                        {approved ? 'Approved ✓' : 'Approve'}
                      </button>
                    </div>
                  )}

                  {animateError && (
                    <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                      <p className="mb-1">{animateError}</p>
                      <button
                        onClick={handleAnimatePreview}
                        className="font-medium underline underline-offset-2"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {previewUrl && (
                    <button
                      onClick={handleAnimatePreview}
                      disabled={animating}
                      className="mb-3 w-full rounded-md border border-honey-oak py-3 text-sm font-medium text-bronze transition hover:bg-honey-oak hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {animating
                        ? 'Animating…'
                        : animatedVideoUrl
                          ? 'Animate Again'
                          : 'Animate Preview'}
                    </button>
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
                  onClick={handleAddToCart}
                  className="w-full rounded-md bg-honey-oak py-3 text-sm font-semibold text-cream transition hover:bg-bronze disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add to Cart
                  {activeVariant && ` — ${centsToPrice(activeVariant.priceCents * quantity)}`}
                </button>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
