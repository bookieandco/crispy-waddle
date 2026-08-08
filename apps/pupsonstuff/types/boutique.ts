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
  | "pop-art";

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
];

/** The modal's active product is just the full hotspot record — every
 * field it needs (pricing, variants, AI template, customization options)
 * already lives on the hotspot config, so there's nothing to duplicate. */
export type ActiveProduct = Hotspot;

export interface CartItem {
  id: string;
  productName: string;
  price: number;
  quantity: number;
  previewUrl?: string;
}
