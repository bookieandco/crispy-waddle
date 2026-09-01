export type FulfillmentProvider = "printify";

export type NormalizedProductVariant = {
  id: string;
  providerVariantId: string;
  title: string;
  sku?: string;
  price?: number;
  currency?: string;
  available: boolean;
};

export type NormalizedFulfillmentProduct = {
  id: string;
  provider: FulfillmentProvider;
  providerProductId: string;
  title: string;
  description?: string;
  images: string[];
  variants: NormalizedProductVariant[];
  metadata?: Record<string, unknown>;
};

export type PrintifyProductPayload = {
  id: string;
  title: string;
  description?: string;
  images?: Array<{ src?: string; [key: string]: unknown }>;
  variants?: Array<{
    id: number | string;
    title?: string;
    sku?: string;
    price?: number;
    is_enabled?: boolean;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

/**
 * Converts provider-shaped catalog data into the storefront's stable contract.
 * No network access or credentials belong in this module.
 */
export function normalizePrintifyProduct(
  payload: PrintifyProductPayload,
): NormalizedFulfillmentProduct {
  return {
    id: `printify:${payload.id}`,
    provider: "printify",
    providerProductId: payload.id,
    title: payload.title,
    description: payload.description,
    images: (payload.images ?? [])
      .map((image) => image.src)
      .filter((src): src is string => Boolean(src)),
    variants: (payload.variants ?? []).map((variant) => ({
      id: `printify:${payload.id}:${variant.id}`,
      providerVariantId: String(variant.id),
      title: variant.title ?? String(variant.id),
      sku: variant.sku,
      price: variant.price,
      currency: "USD",
      available: variant.is_enabled ?? true,
    })),
  };
}
