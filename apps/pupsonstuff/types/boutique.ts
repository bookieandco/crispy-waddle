import { Hotspot } from "@/data/hotspots";

export type ArtStyle =
  | "watercolor"
  | "oil-painting"
  | "royal-portrait"
  | "astronaut"
  | "vintage-concert"
  | "cubist"
  | "cartoon"
  | "memorial"
  | "pencil-sketch"
  | "pop-art"
  | "ascii-art"
  | "studio-ghibli"
  | "flux-dreamscape";

export const artStyles: { id: ArtStyle; label: string }[] = [
  { id: "watercolor", label: "Watercolor" },
  { id: "oil-painting", label: "Oil Painting" },
  { id: "royal-portrait", label: "Royal Portrait" },
  { id: "astronaut", label: "Astronaut" },
  { id: "vintage-concert", label: "Vintage Concert" },
  { id: "cubist", label: "Cubist" },
  { id: "cartoon", label: "Cartoon" },
  { id: "memorial", label: "Memorial" },
  { id: "pencil-sketch", label: "Pencil Sketch" },
  { id: "pop-art", label: "Pop Art" },
  // Unlike every style above (all prompts to the OpenAI image model), this
  // one is deterministic pixel-brightness-to-character conversion
  // (lib/ascii.ts) — no AI model, no API key, genuinely real output every
  // time. See app/api/generate-preview/route.ts for the branch.
  { id: "ascii-art", label: "ASCII Art" },
  // These two route through lib/muapi.ts — a second AI provider
  // (Muapi.ai), not OpenAI, needing its own MUAPI_API_KEY. Added for
  // genuinely different results the OpenAI path doesn't produce: a
  // purpose-built fixed style-transfer model (no prompt involved at all)
  // and a different underlying model family for prompt-driven restyling.
  // See app/api/generate-preview/route.ts for the branch.
  { id: "studio-ghibli", label: "Studio Ghibli" },
  { id: "flux-dreamscape", label: "Flux Dreamscape" },
];

/** The modal's active product is just the full hotspot record — every
 * field it needs (pricing, variants, AI template, customization options)
 * already lives on the hotspot config, so there's nothing to duplicate. */
export type ActiveProduct = Hotspot;

export interface CartItem {
  /** unique per cart entry, not per product — the same product/variant
   * added twice with a different generated preview is two entries, not
   * a merged quantity. Generated client-side (crypto.randomUUID or
   * equivalent), not a catalog ID. */
  id: string;
  productName: string;
  /** cents, matching InventoryVariant.priceCents and every other price
   * in this app — never dollars, despite the unqualified field name
   * (pre-existing before this comment; not renamed to avoid touching
   * every other reference for a naming nit, but this is the real unit). */
  price: number;
  quantity: number;
  previewUrl?: string;
}
