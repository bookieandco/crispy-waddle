import { hotspots, Hotspot } from "@/data/hotspots";
import { ArtStyle, CartItem, artStyles } from "@/types/boutique";

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
  return typeof value === "string" && artStyles.some((style) => style.id === value);
}

function isSafePreviewUrl(value: unknown): value is string | undefined {
  return value === undefined ||
    (typeof value === "string" && value.startsWith("data:image/"));
}

function resolveLegacyDisplayName(name: string) {
  for (const hotspot of hotspots) {
    if (!hotspot.fulfillment) continue;
    for (const variant of hotspot.fulfillment.variants) {
      for (const style of artStyles) {
        const expected = `${hotspot.name} — ${variant.label} — ${style.label}`;
        if (name === expected) return { hotspot, variant, artStyle: style.id };
      }
    }
  }
  return null;
}

export function validateCartItem(item: unknown): ValidatedCartItem | null {
  if (typeof item !== "object" || item === null) return null;
  const raw = item as Record<string, unknown>;
  if (
    typeof raw.id !== "string" ||
    typeof raw.productName !== "string" ||
    typeof raw.quantity !== "number" ||
    !Number.isInteger(raw.quantity) ||
    raw.quantity < 1 ||
    raw.quantity > MAX_QUANTITY ||
    !isSafePreviewUrl(raw.previewUrl)
  ) return null;

  let hotspot: Hotspot | undefined;
  let variant: NonNullable<Hotspot["fulfillment"]>["variants"][number] | undefined;
  let artStyle: ArtStyle | undefined;

  if (
    typeof raw.productId === "string" &&
    typeof raw.variantId === "string" &&
    isArtStyle(raw.artStyle)
  ) {
    hotspot = hotspots.find((candidate) => candidate.id === raw.productId);
    variant = hotspot?.fulfillment?.variants.find(
      (candidate) => candidate.variantId === raw.variantId
    );
    artStyle = raw.artStyle;
  } else {
    const legacy = resolveLegacyDisplayName(raw.productName);
    hotspot = legacy?.hotspot;
    variant = legacy?.variant;
    artStyle = legacy?.artStyle;
  }

  if (!hotspot?.fulfillment || !variant || !artStyle) return null;

  return {
    id: raw.id,
    productId: hotspot.id,
    variantId: variant.variantId,
    productName: hotspot.name,
    variantLabel: variant.label,
    artStyle,
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

/** Reconcile Stripe's historical amount with current catalog fulfillment identity. */
export function validateStripeLineItems(items: unknown): ValidatedCartItem[] | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) return null;
  const validated: ValidatedCartItem[] = [];
  for (const item of items) {
    const raw = item as Record<string, unknown> | null;
    const catalogItem = validateCartItem(item);
    if (
      !catalogItem || !raw || typeof raw.price !== "number" ||
      !Number.isInteger(raw.price) || raw.price <= 0
    ) return null;
    validated.push({ ...catalogItem, priceCents: raw.price });
  }
  return validated;
}

export function cartItemsFromValidated(items: ValidatedCartItem[]): CartItem[] {
  return items.map((item) => ({
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    productName: `${item.productName} — ${item.variantLabel} — ${artStyles.find((s) => s.id === item.artStyle)?.label ?? item.artStyle}`,
    price: item.priceCents,
    quantity: item.quantity,
    previewUrl: item.previewUrl,
    artStyle: item.artStyle,
  }));
}
