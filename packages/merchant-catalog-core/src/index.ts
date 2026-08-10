export type CatalogSyncStatus = "pending" | "synced" | "partial" | "failed";
export type ProductAvailability = "available" | "out_of_stock" | "hidden" | "restricted";

export interface MerchantCatalogProduct {
  externalProductId: string;
  externalVariantId?: string;
  merchantId: string;
  locationId: string;
  name: string;
  brand?: string;
  category: string;
  description?: string;
  sku?: string;
  unitOfMeasure?: string;
  price: { amount: number; currency: string };
  availability: ProductAvailability;
  quantity?: number;
  imageUrls?: string[];
  metadata?: Record<string, string>;
  compliance?: { jurisdictionId: string; eligible: boolean; restrictionCodes: string[] };
  sourceUpdatedAt?: string;
}

export interface MarketplaceOffer {
  offerId: string;
  merchantId: string;
  locationId: string;
  externalProductId: string;
  externalVariantId?: string;
  normalizedProductId: string;
  name: string;
  brand?: string;
  category: string;
  price: { amount: number; currency: string };
  availability: ProductAvailability;
  quantity?: number;
  deliveryZoneIds: string[];
  policyVersion: string;
  sourceUpdatedAt?: string;
  syncedAt: string;
}

export interface CatalogSyncRequest {
  merchantId: string;
  locationId: string;
  cursor?: string;
  idempotencyKey: string;
}

export interface CatalogSyncResult {
  status: CatalogSyncStatus;
  imported: number;
  updated: number;
  hidden: number;
  rejected: number;
  nextCursor?: string;
  errors: Array<{ externalProductId?: string; code: string; message: string }>;
}

export interface CatalogAdapter {
  readonly provider: string;
  listProducts(request: CatalogSyncRequest): Promise<{
    products: MerchantCatalogProduct[];
    nextCursor?: string;
  }>;
}

export interface CatalogNormalizer {
  normalize(product: MerchantCatalogProduct): Promise<{
    normalizedProductId: string;
    offer: Omit<MarketplaceOffer, "offerId" | "syncedAt">;
  }>;
}

export interface CatalogPolicy {
  jurisdictionId: string;
  policyVersion: string;
  allowedCategories?: string[];
  prohibitedCategories?: string[];
}

export interface MarketplaceCatalogStore {
  upsert(offer: MarketplaceOffer): Promise<void>;
  hide(input: { merchantId: string; locationId: string; externalProductId: string; reason: string }): Promise<void>;
}

export interface CatalogSyncEventSink {
  emit(event: {
    eventId: string;
    type: "CATALOG_SYNC_STARTED" | "CATALOG_PRODUCT_UPSERTED" | "CATALOG_PRODUCT_REJECTED" | "CATALOG_SYNC_COMPLETED";
    merchantId: string;
    locationId: string;
    occurredAt: string;
    metadata?: Record<string, string>;
  }): Promise<void>;
}

export class MerchantCatalogSyncService {
  constructor(
    private readonly adapter: CatalogAdapter,
    private readonly normalizer: CatalogNormalizer,
    private readonly store: MarketplaceCatalogStore,
    private readonly events: CatalogSyncEventSink,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async sync(request: CatalogSyncRequest, policy: CatalogPolicy): Promise<CatalogSyncResult> {
    const startedAt = this.now().toISOString();
    await this.events.emit({
      eventId: crypto.randomUUID(),
      type: "CATALOG_SYNC_STARTED",
      merchantId: request.merchantId,
      locationId: request.locationId,
      occurredAt: startedAt,
      metadata: { provider: this.adapter.provider, policyVersion: policy.policyVersion },
    });

    const page = await this.adapter.listProducts(request);
    let imported = 0;
    let updated = 0;
    let hidden = 0;
    let rejected = 0;
    const errors: CatalogSyncResult["errors"] = [];

    for (const product of page.products) {
      try {
        if (product.merchantId !== request.merchantId || product.locationId !== request.locationId) {
          rejected++;
          errors.push({ externalProductId: product.externalProductId, code: "SOURCE_SCOPE_MISMATCH", message: "Catalog item belongs to a different merchant or location" });
          continue;
        }

        if (policy.prohibitedCategories?.includes(product.category)) {
          await this.store.hide({ merchantId: request.merchantId, locationId: request.locationId, externalProductId: product.externalProductId, reason: "PROHIBITED_CATEGORY" });
          hidden++;
          continue;
        }

        if (policy.allowedCategories && !policy.allowedCategories.includes(product.category)) {
          await this.store.hide({ merchantId: request.merchantId, locationId: request.locationId, externalProductId: product.externalProductId, reason: "CATEGORY_NOT_ALLOWED" });
          hidden++;
          continue;
        }

        if (product.compliance && product.compliance.jurisdictionId === policy.jurisdictionId && !product.compliance.eligible) {
          await this.store.hide({ merchantId: request.merchantId, locationId: request.locationId, externalProductId: product.externalProductId, reason: "PRODUCT_NOT_ELIGIBLE" });
          hidden++;
          continue;
        }

        const normalized = await this.normalizer.normalize(product);
        const offer: MarketplaceOffer = {
          ...normalized.offer,
          offerId: `${request.merchantId}:${request.locationId}:${product.externalProductId}:${product.externalVariantId ?? "default"}`,
          policyVersion: policy.policyVersion,
          syncedAt: this.now().toISOString(),
        };
        await this.store.upsert(offer);
        imported++;
        await this.events.emit({
          eventId: crypto.randomUUID(),
          type: "CATALOG_PRODUCT_UPSERTED",
          merchantId: request.merchantId,
          locationId: request.locationId,
          occurredAt: this.now().toISOString(),
          metadata: { externalProductId: product.externalProductId, offerId: offer.offerId },
        });
      } catch (error) {
        rejected++;
        errors.push({ externalProductId: product.externalProductId, code: "NORMALIZATION_FAILED", message: error instanceof Error ? error.message : "Unknown catalog synchronization error" });
      }
    }

    const status: CatalogSyncStatus = rejected === 0 ? "synced" : imported > 0 ? "partial" : "failed";
    await this.events.emit({
      eventId: crypto.randomUUID(),
      type: "CATALOG_SYNC_COMPLETED",
      merchantId: request.merchantId,
      locationId: request.locationId,
      occurredAt: this.now().toISOString(),
      metadata: { status, imported: String(imported), hidden: String(hidden), rejected: String(rejected) },
    });

    return { status, imported, updated, hidden, rejected, nextCursor: page.nextCursor, errors };
  }
}

export const MERCHANT_CATALOG_CORE_VERSION = "0.1.0" as const;
