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
  /** Optional on legacy localStorage carts; the server resolves it from the catalog/display name. */
  productId?: string;
  /** Optional on legacy localStorage carts; the server resolves it from the catalog/display name. */
  variantId?: string;
  productName: string;
  /** Display-only cents value. The server never trusts this for pricing. */
  price: number;
  quantity: number;
  previewUrl?: string;
  /** Optional on legacy localStorage carts; the server resolves it from the product display name. */
  artStyle?: ArtStyle;
}
