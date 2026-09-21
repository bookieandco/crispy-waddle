import type {
  SupplierOfferSnapshot,
  SupplierSourcingAdapter,
  SupplierSourcingQuery,
} from "./supplier";

export interface Raw1688Offer {
  offerId: string;
  supplierId: string;
  title: string;
  inventoryId?: string;
  availableQuantity?: number;
  unitAmountMinor?: number;
  shippingAmountMinor?: number;
  currency?: string;
  estimatedDeliveryDays?: number;
  supplierRiskScore?: number;
  destinationCountries?: string[];
  excludedDestinationCountries?: string[];
  observedAt?: string;
}

export interface Supplier1688ResearchClient {
  search(input: {
    query: string;
    destinationCountry: string;
    currency: string;
    limit: number;
  }): Promise<Raw1688Offer[]>;
}

/**
 * Thin provider adapter for the stable JSON/research surface exposed by the
 * audited 1688 integration. Authentication, anti-bot handling, and transport
 * stay in the injected client. This adapter only normalizes observed provider
 * facts into Commerce supplier snapshots and performs no cart/order mutation.
 */
export class Supplier1688SourcingAdapter implements SupplierSourcingAdapter {
  readonly name = "1688";

  constructor(
    private readonly connectionId: string,
    private readonly client: Supplier1688ResearchClient,
  ) {}

  async search(query: SupplierSourcingQuery): Promise<SupplierOfferSnapshot[]> {
    const limit = Math.max(1, Math.min(100, query.limit ?? 25));
    const rows = await this.client.search({
      query: query.query,
      destinationCountry: query.destinationCountry.trim().toUpperCase(),
      currency: query.currency.trim().toUpperCase(),
      limit,
    });

    return rows.flatMap((row): SupplierOfferSnapshot[] => {
      if (
        !row.offerId?.trim() ||
        !row.supplierId?.trim() ||
        !row.title?.trim() ||
        !Number.isFinite(row.unitAmountMinor) ||
        (row.unitAmountMinor ?? -1) < 0 ||
        !Number.isFinite(row.availableQuantity) ||
        (row.availableQuantity ?? -1) < 0
      ) {
        return [];
      }

      return [{
        provider: "1688",
        connectionId: this.connectionId,
        supplierId: row.supplierId.trim(),
        productId: row.offerId.trim(),
        inventoryId: row.inventoryId?.trim() || `1688:${row.offerId.trim()}:inventory`,
        title: row.title.trim(),
        externalProduct: { provider: "1688", externalId: row.offerId.trim() },
        unitAmountMinor: row.unitAmountMinor!,
        shippingAmountMinor: Math.max(0, row.shippingAmountMinor ?? 0),
        currency: (row.currency ?? query.currency).trim().toUpperCase(),
        availableQuantity: row.availableQuantity!,
        estimatedDeliveryDays: Math.max(0, row.estimatedDeliveryDays ?? 0),
        supplierRiskScore: Math.max(0, row.supplierRiskScore ?? 1),
        destinationCountries: (row.destinationCountries ?? [query.destinationCountry])
          .map((country) => country.trim().toUpperCase())
          .filter(Boolean),
        excludedDestinationCountries: (row.excludedDestinationCountries ?? [])
          .map((country) => country.trim().toUpperCase())
          .filter(Boolean),
        observedAt: normalizeTimestamp(row.observedAt),
      }];
    });
  }
}

function normalizeTimestamp(value?: string): string {
  if (!value) return new Date().toISOString();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("1688 observation timestamp is invalid");
  return new Date(parsed).toISOString();
}
