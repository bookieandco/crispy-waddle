import "server-only";

import type {
  TikTokPodEligibilityState,
  TikTokPodFulfillmentObservation,
  TikTokPodMadeToOrderState,
  TikTokPodShippingMode,
  TikTokPodTaxState,
} from "@jhadina/opportunity-core";

const PRINTIFY_BASE_URL = "https://api.printify.com";

export type PrintifyShopSnapshot = {
  id: number;
  title: string;
  salesChannel: string;
};

export type PrintifyProductSnapshot = {
  id: string;
  title: string;
  blueprintId: number;
  printProviderId: number;
  visible: boolean;
  variants: Array<{
    id: number;
    sku: string;
    cost: number;
    price: number;
    isEnabled: boolean;
    isAvailable?: boolean;
  }>;
};

export type PrintifyProviderSnapshot = {
  id: number;
  title: string;
  country: string;
  region: string;
};

export type PrintifyShippingSnapshot = {
  handlingValue?: number;
  handlingUnit?: string;
  supportedCountries: string[];
};

export interface TikTokPrintifyReadClient {
  listShops(): Promise<PrintifyShopSnapshot[]>;
  getProduct(shopId: string, productId: string): Promise<PrintifyProductSnapshot>;
  getPrintProvider(printProviderId: number): Promise<PrintifyProviderSnapshot>;
  getBlueprintShipping(blueprintId: number, printProviderId: number): Promise<PrintifyShippingSnapshot>;
}

export type TikTokPrintifyFulfillmentInput = {
  printifyShopId?: string;
  printifyProductId: string;
  tiktokProductRef: string;
  merchantRegion: string;
  destinationRegion: string;
  channelEligibility: TikTokPodEligibilityState;
  taxInfoState: TikTokPodTaxState;
  shippingMode: TikTokPodShippingMode;
  madeToOrderState: TikTokPodMadeToOrderState;
  maxPermittedHandlingBusinessDays?: number;
  trackingCompatible?: boolean;
  observedAt?: string;
  tikTokEvidenceRefs: readonly string[];
};

export async function observeTikTokPodFulfillmentFromPrintify(
  client: TikTokPrintifyReadClient,
  input: TikTokPrintifyFulfillmentInput,
): Promise<TikTokPodFulfillmentObservation> {
  const shops = await client.listShops();
  const shop = resolveShop(shops, input.printifyShopId);
  const product = await client.getProduct(String(shop.id), input.printifyProductId);
  const provider = await client.getPrintProvider(product.printProviderId);
  const shipping = await client.getBlueprintShipping(product.blueprintId, product.printProviderId);
  const observedAt = input.observedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new Error("TIKTOK_PRINTIFY_OBSERVED_AT_INVALID");
  }

  const normalizedDestination = normalizeRegion(input.destinationRegion);
  const supported = new Set(shipping.supportedCountries.map(normalizeRegion));
  const providerSupportsDestination =
    supported.size > 0 ? supported.has(normalizedDestination) : undefined;
  const estimatedHandlingBusinessDays = normalizeHandlingDays(
    shipping.handlingValue,
    shipping.handlingUnit,
  );

  const salesChannelConnection =
    shop.salesChannel.toLowerCase().includes("tiktok")
      ? "connected"
      : shop.salesChannel.toLowerCase() === "disconnected"
        ? "disconnected"
        : "unknown";

  const evidenceRefs = [
    ...input.tikTokEvidenceRefs,
    `printify:shop:${shop.id}`,
    `printify:product:${product.id}`,
    `printify:provider:${provider.id}`,
    `printify:blueprint-shipping:${product.blueprintId}`,
  ];

  return Object.freeze({
    observationId: `tiktok-pod-fulfillment:${input.tiktokProductRef}:${Date.parse(observedAt)}`,
    productRef: input.tiktokProductRef,
    providerRef: `printify:provider:${provider.id}`,
    merchantRegion: input.merchantRegion,
    destinationRegion: input.destinationRegion,
    providerRegion: [provider.region, provider.country].filter(Boolean).join(", "),
    salesChannelConnection,
    channelEligibility: input.channelEligibility,
    taxInfoState: input.taxInfoState,
    shippingMode: input.shippingMode,
    madeToOrderState: input.madeToOrderState,
    estimatedHandlingBusinessDays,
    maxPermittedHandlingBusinessDays: input.maxPermittedHandlingBusinessDays,
    trackingCompatible: input.trackingCompatible,
    providerSupportsDestination,
    sourceRef: `printify:product:${product.id}`,
    evidenceRefs: Object.freeze([...new Set(evidenceRefs)]),
    observedAt,
  });
}

export function createPrintifyTikTokReadClient(input: {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
} = {}): TikTokPrintifyReadClient {
  const apiKey = (input.apiKey ?? process.env.PRINTIFY_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("TIKTOK_PRINTIFY_API_KEY_REQUIRED");
  const baseUrl = (input.baseUrl ?? PRINTIFY_BASE_URL).replace(/\/+$/, "");
  if (new URL(baseUrl).protocol !== "https:") {
    throw new Error("TIKTOK_PRINTIFY_HTTPS_REQUIRED");
  }
  const fetchImpl = input.fetchImpl ?? fetch;

  async function get<T>(path: string): Promise<T> {
    const response = await fetchImpl(baseUrl + path, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": "Jhadina/TikTokBusinessFactory",
      },
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`TIKTOK_PRINTIFY_HTTP_${response.status}:${safeMessage(text)}`);
    }
    return JSON.parse(text) as T;
  }

  return {
    async listShops() {
      const rows = await get<Array<Record<string, unknown>>>("/v1/shops.json");
      return rows.map((row) => ({
        id: numberRequired(row.id, "TIKTOK_PRINTIFY_SHOP_ID_MISSING"),
        title: stringRequired(row.title, "TIKTOK_PRINTIFY_SHOP_TITLE_MISSING"),
        salesChannel: stringRequired(
          row.sales_channel ?? "unknown",
          "TIKTOK_PRINTIFY_SALES_CHANNEL_MISSING",
        ),
      }));
    },

    async getProduct(shopId, productId) {
      const raw = await get<Record<string, unknown>>(
        `/v1/shops/${encodeURIComponent(shopId)}/products/${encodeURIComponent(productId)}.json`,
      );
      const variants = Array.isArray(raw.variants) ? raw.variants : [];
      return {
        id: stringRequired(raw.id, "TIKTOK_PRINTIFY_PRODUCT_ID_MISSING"),
        title: stringRequired(raw.title, "TIKTOK_PRINTIFY_PRODUCT_TITLE_MISSING"),
        blueprintId: numberRequired(raw.blueprint_id, "TIKTOK_PRINTIFY_BLUEPRINT_ID_MISSING"),
        printProviderId: numberRequired(raw.print_provider_id, "TIKTOK_PRINTIFY_PROVIDER_ID_MISSING"),
        visible: raw.visible === true,
        variants: variants
          .filter(isRecord)
          .map((variant) => ({
            id: numberRequired(variant.id, "TIKTOK_PRINTIFY_VARIANT_ID_MISSING"),
            sku: typeof variant.sku === "string" ? variant.sku : "",
            cost: numberRequired(variant.cost, "TIKTOK_PRINTIFY_VARIANT_COST_MISSING"),
            price: numberRequired(variant.price, "TIKTOK_PRINTIFY_VARIANT_PRICE_MISSING"),
            isEnabled: variant.is_enabled === true,
            isAvailable:
              typeof variant.is_available === "boolean"
                ? variant.is_available
                : undefined,
          })),
      };
    },

    async getPrintProvider(printProviderId) {
      const raw = await get<Record<string, unknown>>(
        `/v1/catalog/print_providers/${printProviderId}.json`,
      );
      const location = isRecord(raw.location) ? raw.location : {};
      return {
        id: numberRequired(raw.id, "TIKTOK_PRINTIFY_PROVIDER_ID_MISSING"),
        title: stringRequired(raw.title, "TIKTOK_PRINTIFY_PROVIDER_TITLE_MISSING"),
        country: typeof location.country === "string" ? location.country : "",
        region: typeof location.region === "string" ? location.region : "",
      };
    },

    async getBlueprintShipping(blueprintId, printProviderId) {
      const raw = await get<Record<string, unknown>>(
        `/v1/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/shipping.json`,
      );
      const handling = isRecord(raw.handling_time) ? raw.handling_time : {};
      const profiles = Array.isArray(raw.profiles) ? raw.profiles.filter(isRecord) : [];
      const supportedCountries = profiles.flatMap((profile) =>
        Array.isArray(profile.countries)
          ? profile.countries.filter((value): value is string => typeof value === "string")
          : [],
      );
      return {
        handlingValue: finiteNumber(handling.value),
        handlingUnit: typeof handling.unit === "string" ? handling.unit : undefined,
        supportedCountries: [...new Set(supportedCountries)],
      };
    },
  };
}

function resolveShop(
  shops: PrintifyShopSnapshot[],
  explicitId: string | undefined,
): PrintifyShopSnapshot {
  if (explicitId?.trim()) {
    const found = shops.find((shop) => String(shop.id) === explicitId.trim());
    if (!found) throw new Error("TIKTOK_PRINTIFY_CONFIGURED_SHOP_NOT_FOUND");
    return found;
  }
  if (shops.length === 1) return shops[0]!;
  if (shops.length === 0) throw new Error("TIKTOK_PRINTIFY_NO_SHOP");
  throw new Error("TIKTOK_PRINTIFY_SHOP_ID_REQUIRED_FOR_MULTIPLE_SHOPS");
}

function normalizeHandlingDays(
  value: number | undefined,
  unit: string | undefined,
): number | undefined {
  if (value === undefined) return undefined;
  const normalized = (unit ?? "").trim().toLowerCase();
  if (["day", "days", "business_day", "business_days"].includes(normalized)) {
    return value;
  }
  if (["hour", "hours"].includes(normalized)) return Math.ceil(value / 24);
  return undefined;
}

function normalizeRegion(value: string): string {
  return value.trim().toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function numberRequired(value: unknown, code: string): number {
  const parsed = finiteNumber(value);
  if (parsed === undefined) throw new Error(code);
  return parsed;
}

function stringRequired(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function safeMessage(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").slice(0, 300);
}
