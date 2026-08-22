import { hotspots, Hotspot } from "@/data/hotspots";
import { ArtStyle, CartItem } from "@/types/boutique";

export interface ValidatedCartItem {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  artStyle: ArtStyle;
  priceCents: number;
  quantity: number;
  previewUrl?: string;
  fulfillment?: Hotspot["fulfillment"];
}

const MAX_QUANTITY = 100;

function isArtStyle(value: unknown): value is ArtStyle {
  return typeof value === "string" && [
    "watercolor", "oil-painting", "royal-portrait", "astronaut",
    "vintage-concert", "cubist", "cartoon", "memorial", "pencil-sketch",
    "pop-art", "ascii-art", "studio-ghibli", "flux-dreamscape",
  ].includes(value);
}

function isSafePreviewUrl(value: unknown): value is string | undefined {
  return value === undefined ||
    (typeof value === "string" && value.startsWith("data:image/"));
}

export function validateCartItem(item: unknown): ValidatedCartItem | null {
  if (typeof item !== "object" || item === null) return null;
  const raw = item as Record<string, unknown>;
  if (
    typeof raw.id !== "string" ||
    typeof raw.productId !== "string" ||
    typeof raw.variantId !== "string" ||
    !isArtStyle(raw.artStyle) ||
    typeof raw.quantity !== "number" ||
    !Number.isInteger(raw.quantity) ||
    raw.quantity < 1 ||
    raw.quantity > MAX_QUANTITY ||
    !isSafePreviewUrl(raw.previewUrl)
  ) return null;

  const hotspot = hotspots.find((candidate) => candidate.id === raw.productId);
  if (!hotspot?.fulfillment) return null;

  const variant = hotspot.fulfillment.variants.find(
    (candidate) => candidate.variantId === raw.variantId
  );
  if (!variant) return null;

  return {
    id: raw.id,
    productId: hotspot.id,
    variantId: variant.variantId,
    productName: hotspot.name,
    variantLabel: variant.label,
    artStyle: raw.artStyle,
    priceCents: variant.priceCents,
    quantity: raw.quantity,
    previewUrl: raw.previewUrl,
    fulfillment: hotspot.fulfillment,
  };
}

export function validateCart(items: unknown): ValidatedCartItem[] | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) return null;
  const validated = items.map(validateCartItem);
  return validated.every(Boolean) ? validated as ValidatedCartItem[] : null;
}

export function cartItemsFromValidated(items: ValidatedCartItem[]): CartItem[] {
  return items.map((item) => ({
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    productName: `${item.productName} — ${item.variantLabel}`,
    price: item.priceCents,
    quantity: item.quantity,
    previewUrl: item.previewUrl,
    artStyle: item.artStyle,
  }));
}
