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
  { id: "ascii-art", label: "ASCII Art" },
  { id: "studio-ghibli", label: "Studio Ghibli" },
  { id: "flux-dreamscape", label: "Flux Dreamscape" },
];

export type ActiveProduct = Hotspot;

export interface CartItem {
  id: string;
  /** Stable catalog/hotspot id used by the server to re-price the item. */
  productId: string;
  /** Stable inventory variant id used by the server to re-price the item. */
  variantId: string;
  /** Display-only product name. The server never trusts this for pricing. */
  productName: string;
  /** Display-only cents value. The server never trusts this for pricing. */
  price: number;
  quantity: number;
  /** Generated preview currently lives in browser storage; fulfillment persistence is a separate gate. */
  previewUrl?: string;
  /** Stable style id used for the eventual order/fulfillment record. */
  artStyle: ArtStyle;
}
