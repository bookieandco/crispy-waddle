import type {
  SupplierDiscoveryAdapter,
  SupplierDiscoveryObservation,
  SupplierDiscoveryQuery,
} from "./supplier";

export interface RawDhgateProduct {
  itemcode?: string | number;
  productId?: string;
  productName?: string;
  price?: string;
  simHighPrice?: string | number;
  minOrder?: string;
  minOrderNum?: number;
  currency?: string;
  productUrl?: string;
  imageUrl?: string;
  sellerName?: string;
  sellerId?: string;
  sellerStoreUrl?: string;
  sellerLevel?: string;
  feedbackPercent?: string | number;
  freeShipping?: boolean;
  isAd?: boolean;
  reviewCount?: number | null;
  reviewScore?: number | null;
  searchKeyword?: string;
  scrapedAt?: string;
}

export interface DhgateResearchClient {
  search(input: {
    query: string;
    destinationCountry?: string;
    limit: number;
  }): Promise<RawDhgateProduct[]>;
}

/**
 * Read-only discovery adapter for DHgate-style product research.
 *
 * This deliberately returns SupplierDiscoveryObservation rather than
 * SupplierOfferSnapshot because search results do not prove routable
 * inventory, shipping cost, or delivery SLA. A separate enrichment step
 * must verify those facts before an offer can enter procurement routing.
 */
export class DhgateSupplierDiscoveryAdapter implements SupplierDiscoveryAdapter {
  readonly name = "dhgate";

  constructor(
    private readonly client: DhgateResearchClient,
  ) {}

  async search(query: SupplierDiscoveryQuery): Promise<SupplierDiscoveryObservation[]> {
    const limit = Math.max(1, Math.min(500, query.limit ?? 100));
    const rows = await this.client.search({
      query: query.query,
      destinationCountry: query.destinationCountry?.trim().toUpperCase(),
      limit,
    });

    return rows.flatMap((row): SupplierDiscoveryObservation[] => {
      const productId = String(row.itemcode ?? row.productId ?? "").trim();
      const title = row.productName?.trim() ?? "";
      if (!productId || !title) return [];

      const range = parseDhgatePrice(row.price, row.simHighPrice);
      const feedback = normalizePercent(row.feedbackPercent);
      const minimumOrderQuantity =
        Number.isFinite(row.minOrderNum) && (row.minOrderNum ?? 0) > 0
          ? Math.floor(row.minOrderNum!)
          : parseMinimumOrder(row.minOrder);
      const observedAt = normalizeTimestamp(row.scrapedAt);

      return [{
        provider: "dhgate",
        sourceId: `dhgate:${productId}`,
        productId,
        title,
        supplierId: row.sellerId?.trim() || undefined,
        supplierName: row.sellerName?.trim() || undefined,
        supplierStoreUrl: row.sellerStoreUrl?.trim() || undefined,
        productUrl: row.productUrl?.trim() || undefined,
        imageUrl: row.imageUrl?.trim() || undefined,
        minUnitAmountMinor: range?.min,
        maxUnitAmountMinor: range?.max,
        currency: range ? (row.currency ?? query.currency ?? "USD").trim().toUpperCase() : undefined,
        minimumOrderQuantity,
        sellerFeedbackPercent: feedback,
        reviewCount:
          Number.isFinite(row.reviewCount) && (row.reviewCount ?? 0) >= 0
            ? Math.floor(row.reviewCount!)
            : undefined,
        freeShipping: row.freeShipping,
        sponsored: row.isAd,
        destinationCountry: query.destinationCountry?.trim().toUpperCase(),
        observedAt,
        metadata: {
          ...(row.sellerLevel?.trim() ? { sellerLevel: row.sellerLevel.trim() } : {}),
          ...(row.reviewScore !== null && row.reviewScore !== undefined
            ? { reviewScore: String(row.reviewScore) }
            : {}),
          ...(row.searchKeyword?.trim() ? { searchKeyword: row.searchKeyword.trim() } : {}),
        },
      }];
    });
  }
}

export function parseDhgatePrice(
  price?: string,
  high?: string | number,
): { min: number; max: number } | undefined {
  const parsed = (price ?? "").match(/\d+(?:\.\d+)?/g)?.map(decimalToMinor) ?? [];
  const highMinor =
    high === undefined || high === null || String(high).trim() === ""
      ? undefined
      : decimalToMinor(String(high));

  const finite = parsed.filter((value) => Number.isFinite(value) && value >= 0);
  if (highMinor !== undefined && Number.isFinite(highMinor) && highMinor >= 0) finite.push(highMinor);
  if (finite.length === 0) return undefined;
  return { min: Math.min(...finite), max: Math.max(...finite) };
}

function decimalToMinor(input: string): number {
  const match = input.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return Number.NaN;
  const dollars = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  return dollars * 100 + cents;
}

function normalizePercent(value?: string | number): number | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = Number(String(value).replace("%", "").trim());
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return undefined;
  return parsed;
}

function parseMinimumOrder(value?: string): number | undefined {
  if (!value) return undefined;
  const match = value.match(/\d+/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeTimestamp(value?: string): string {
  if (!value) return new Date().toISOString();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("DHgate observation timestamp is invalid");
  return new Date(parsed).toISOString();
}
