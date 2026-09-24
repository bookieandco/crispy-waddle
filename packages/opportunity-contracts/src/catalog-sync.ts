export type CommerceChannel =
  | "shopify"
  | "etsy"
  | "amazon"
  | "woocommerce"
  | "marketplace"
  | "supplier"
  | "other";

export interface CatalogReference {
  channel: CommerceChannel;
  provider: string;
  externalId: string;
  productId: string;
  observedAt: string;
}

export interface CatalogProductState {
  productId: string;
  title?: string;
  description?: string;
  status: "draft" | "active" | "paused" | "archived";
  references: CatalogReference[];
  version: number;
  observedAt: string;
}

export interface CatalogSyncConflict {
  conflictId: string;
  productId: string;
  field: string;
  sources: Array<{
    provider: string;
    value: string;
    observedAt: string;
  }>;
  detectedAt: string;
}

export interface CatalogSyncProvider {
  read(reference: CatalogReference): Promise<CatalogProductState | null>;
  publish(
    state: CatalogProductState,
    channel: CommerceChannel,
  ): Promise<CatalogReference>;
}

export interface InventoryState {
  productId: string;
  variantId?: string;
  available: number;
  reserved: number;
  incoming?: number;
  source: string;
  observedAt: string;
  version: number;
}

export interface InventorySyncProvider {
  read(productId: string, variantId?: string): Promise<InventoryState | null>;
  publish(state: InventoryState): Promise<void>;
}
