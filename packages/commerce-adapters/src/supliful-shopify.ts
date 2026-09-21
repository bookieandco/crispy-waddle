export const SUPLIFUL_SHOPIFY_FULFILLMENT_SERVICE = "Supliful Fulfillment" as const;

export interface SuplifulShopifyProductBinding {
  internalProductId: string;
  internalVariantId: string;
  shopifyProductGid: string;
  shopifyVariantGid: string;
  sku?: string;
  fulfillmentServiceName: string;
  observedAt: string;
}

export interface SuplifulShopifyOrderBinding {
  internalOrderId: string;
  shopifyOrderGid: string;
  shopifyOrderName?: string;
  shopifyFulfillmentOrderGid?: string;
  fulfillmentStatus:
    | "unfulfilled"
    | "scheduled"
    | "in_progress"
    | "fulfilled"
    | "cancelled"
    | "unknown";
  observedAt: string;
}

export function assertSuplifulShopifyProductBinding(
  binding: SuplifulShopifyProductBinding,
): void {
  if (!binding.internalProductId.trim()) throw new Error("internalProductId is required");
  if (!binding.internalVariantId.trim()) throw new Error("internalVariantId is required");
  assertShopifyGid(binding.shopifyProductGid, "Product");
  assertShopifyGid(binding.shopifyVariantGid, "ProductVariant");
  if (binding.fulfillmentServiceName !== SUPLIFUL_SHOPIFY_FULFILLMENT_SERVICE) {
    throw new Error("Supliful products must be assigned to the Supliful Fulfillment service");
  }
  assertTimestamp(binding.observedAt);
}

export function assertSuplifulShopifyOrderBinding(
  binding: SuplifulShopifyOrderBinding,
): void {
  if (!binding.internalOrderId.trim()) throw new Error("internalOrderId is required");
  assertShopifyGid(binding.shopifyOrderGid, "Order");
  if (binding.shopifyFulfillmentOrderGid) {
    assertShopifyGid(binding.shopifyFulfillmentOrderGid, "FulfillmentOrder");
  }
  assertTimestamp(binding.observedAt);
}

function assertShopifyGid(value: string, type: string): void {
  const prefix = `gid://shopify/${type}/`;
  if (!value.startsWith(prefix) || value.length <= prefix.length) {
    throw new Error(`Expected Shopify ${type} GID`);
  }
}

function assertTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error("observedAt must be a valid timestamp");
}
