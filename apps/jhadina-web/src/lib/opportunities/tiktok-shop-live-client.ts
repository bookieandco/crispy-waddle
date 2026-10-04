import "server-only";

import { createHmac } from "node:crypto";
import type {
  TikTokMoneyMetric,
  TikTokOfferObservation,
  TikTokShopCapabilityObservation,
  TikTokShopProductObservation,
} from "@jhadina/growth-core";

const DEFAULT_BASE_URL = "https://open-api.tiktokglobalshop.com";

export type TikTokShopLiveConfig = {
  appKey: string;
  appSecret: string;
  accessToken: string;
  shopCipher: string;
  shopRegion: string;
  accountRef: string;
  baseUrl?: string;
};

export type TikTokShopApiEnvelope<T> = {
  code: number;
  message?: string;
  request_id?: string;
  data?: T;
};

export type TikTokAuthorizedShop = {
  id?: string;
  cipher?: string;
  code?: string;
  name?: string;
  region?: string;
  seller_type?: string;
  raw: Record<string, unknown>;
};

export type TikTokAuthorizationObservation = {
  observationId: string;
  accountRef: string;
  shopCipher: string;
  shopRegion: string;
  authorized: boolean;
  matchedShop?: TikTokAuthorizedShop;
  sourceRef: string;
  evidenceRefs: readonly string[];
  observedAt: string;
  secretMaterialExposed: false;
};

export type TikTokProductSnapshot = {
  productId: string;
  title: string;
  status?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
  skus: Array<{
    id?: string;
    sellerSku?: string;
    price?: { amount: string; currency: string };
    salePrice?: { amount: string; currency: string };
    inventory?: Array<Record<string, unknown>>;
  }>;
  raw: Record<string, unknown>;
};

export type TikTokPromotionActivitySnapshot = {
  activityId: string;
  title: string;
  activityType: string;
  status: string;
  beginTime?: number;
  endTime?: number;
  products: Array<{
    id: string;
    activityPrice?: { amount: string; currency: string };
    discount?: string;
  }>;
  raw: Record<string, unknown>;
};

export type TikTokOrderStatementSnapshot = {
  orderId: string;
  currency: string;
  revenueAmount?: string;
  feeAndTaxAmount?: string;
  shippingCostAmount?: string;
  settlementAmount?: string;
  skuTransactions: Array<Record<string, unknown>>;
  raw: Record<string, unknown>;
};

export type TikTokPaymentSnapshot = {
  id: string;
  status?: string;
  amount?: { value: string; currency: string };
  settlementAmount?: { value: string; currency: string };
  paidTime?: number;
  raw: Record<string, unknown>;
};

export type TikTokShopFetch = typeof fetch;

export class TikTokShopLiveClient {
  private readonly baseUrl: string;

  constructor(
    private readonly config: TikTokShopLiveConfig,
    private readonly fetchImpl: TikTokShopFetch = fetch,
  ) {
    for (const [field, value] of Object.entries({
      appKey: config.appKey,
      appSecret: config.appSecret,
      accessToken: config.accessToken,
      shopCipher: config.shopCipher,
      shopRegion: config.shopRegion,
      accountRef: config.accountRef,
    })) {
      if (!value.trim()) throw new Error(`TIKTOK_LIVE_${field.toUpperCase()}_REQUIRED`);
    }
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const url = new URL(this.baseUrl);
    if (url.protocol !== "https:") throw new Error("TIKTOK_LIVE_BASE_URL_HTTPS_REQUIRED");
  }

  async getAuthorizedShops(now = new Date()): Promise<TikTokAuthorizedShop[]> {
    const data = await this.request<Record<string, unknown>>({
      method: "GET",
      path: "/authorization/202309/shops",
      query: {},
      now,
      includeShopCipher: false,
    });
    const shops = firstArray(data, ["shops", "authorized_shops", "shop_list"]);
    return shops.map((raw) => mapAuthorizedShop(raw));
  }

  async verifyConfiguredShop(now = new Date()): Promise<TikTokAuthorizationObservation> {
    const shops = await this.getAuthorizedShops(now);
    const matched = shops.find((shop) =>
      [shop.cipher, shop.id, shop.code].filter(Boolean).includes(this.config.shopCipher),
    );
    const observedAt = now.toISOString();
    const requestRef = `tiktok-shop:authorization:shops:${observedAt}`;
    return Object.freeze({
      observationId: `tiktok-auth:${this.config.accountRef}:${now.getTime()}`,
      accountRef: this.config.accountRef,
      shopCipher: this.config.shopCipher,
      shopRegion: this.config.shopRegion,
      authorized: Boolean(matched),
      matchedShop: matched,
      sourceRef: requestRef,
      evidenceRefs: Object.freeze([
        requestRef,
        ...(matched?.id ? [`tiktok-shop:shop:${matched.id}`] : []),
      ]),
      observedAt,
      secretMaterialExposed: false as const,
    });
  }

  async searchProducts(input: {
    pageSize?: number;
    pageToken?: string;
    status?: string;
    sellerSkus?: string[];
  }, now = new Date()): Promise<{ products: TikTokProductSnapshot[]; nextPageToken?: string }> {
    const pageSize = Math.max(1, Math.min(input.pageSize ?? 50, 100));
    const data = await this.request<Record<string, unknown>>({
      method: "POST",
      path: "/product/202309/products/search",
      query: {
        page_size: String(pageSize),
        ...(input.pageToken ? { page_token: input.pageToken } : {}),
      },
      body: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.sellerSkus?.length ? { seller_skus: input.sellerSkus } : {}),
      },
      now,
    });
    const products = firstArray(data, ["products", "product_list"]).map(mapProductSnapshot);
    return {
      products,
      nextPageToken: readString(data, "next_page_token") ?? readString(data, "nextPageToken"),
    };
  }

  async getProduct(productId: string, now = new Date()): Promise<TikTokProductSnapshot> {
    const id = requireText(productId, "TIKTOK_LIVE_PRODUCT_ID_REQUIRED");
    const data = await this.request<Record<string, unknown>>({
      method: "GET",
      path: `/product/202309/products/${encodeURIComponent(id)}`,
      query: {},
      now,
    });
    return mapProductSnapshot(data);
  }

  async getPromotionActivity(activityId: string, now = new Date()): Promise<TikTokPromotionActivitySnapshot> {
    const id = requireText(activityId, "TIKTOK_LIVE_ACTIVITY_ID_REQUIRED");
    const data = await this.request<Record<string, unknown>>({
      method: "GET",
      path: `/promotion/202309/activities/${encodeURIComponent(id)}`,
      query: {},
      now,
    });
    return mapPromotionSnapshot(data);
  }

  async getOrderStatementTransactions(orderId: string, now = new Date()): Promise<TikTokOrderStatementSnapshot> {
    const id = requireText(orderId, "TIKTOK_LIVE_ORDER_ID_REQUIRED");
    const data = await this.request<Record<string, unknown>>({
      method: "GET",
      path: `/finance/202501/orders/${encodeURIComponent(id)}/statement_transactions`,
      query: {},
      now,
    });
    return mapOrderStatement(data, id);
  }

  async getPayments(input: {
    createTimeGe?: number;
    createTimeLt?: number;
    pageSize?: number;
    pageToken?: string;
  }, now = new Date()): Promise<{ payments: TikTokPaymentSnapshot[]; nextPageToken?: string }> {
    const data = await this.request<Record<string, unknown>>({
      method: "GET",
      path: "/finance/202605/payments",
      query: {
        ...(input.createTimeGe !== undefined ? { create_time_ge: String(input.createTimeGe) } : {}),
        ...(input.createTimeLt !== undefined ? { create_time_lt: String(input.createTimeLt) } : {}),
        ...(input.pageSize !== undefined ? { page_size: String(Math.max(1, Math.min(input.pageSize, 100))) } : {}),
        ...(input.pageToken ? { page_token: input.pageToken } : {}),
      },
      now,
    });
    const payments = firstArray(data, ["payments", "payment_list"]).map(mapPaymentSnapshot);
    return {
      payments,
      nextPageToken: readString(data, "next_page_token") ?? readString(data, "nextPageToken"),
    };
  }

  private async request<T>(input: {
    method: "GET" | "POST";
    path: string;
    query: Record<string, string>;
    body?: unknown;
    now: Date;
    includeShopCipher?: boolean;
  }): Promise<T> {
    const timestamp = Math.floor(input.now.getTime() / 1000);
    const query = {
      ...input.query,
      app_key: this.config.appKey,
      timestamp: String(timestamp),
      ...(input.includeShopCipher === false ? {} : { shop_cipher: this.config.shopCipher }),
    };
    const bodyText = input.body === undefined ? "" : JSON.stringify(input.body);
    const sign = signTikTokShopRequest({
      path: input.path,
      query,
      bodyText,
      appSecret: this.config.appSecret,
    });
    const url = new URL(this.baseUrl + input.path);
    for (const [key, value] of Object.entries({ ...query, sign })) {
      url.searchParams.set(key, value);
    }

    const response = await this.fetchImpl(url, {
      method: input.method,
      headers: {
        "content-type": "application/json",
        "x-tts-access-token": this.config.accessToken,
      },
      body: input.method === "POST" ? bodyText || "{}" : undefined,
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`TIKTOK_LIVE_HTTP_${response.status}:${safeMessage(text)}`);
    }
    const envelope = JSON.parse(text) as TikTokShopApiEnvelope<T>;
    if (envelope.code !== 0) {
      throw new Error(
        `TIKTOK_LIVE_API_${envelope.code}:${safeMessage(envelope.message ?? "unknown_error")}:${envelope.request_id ?? "no_request_id"}`,
      );
    }
    if (envelope.data === undefined) throw new Error("TIKTOK_LIVE_DATA_MISSING");
    return envelope.data;
  }
}

/**
 * TikTok Shop documents HMAC-SHA256 request signing and requires the exact
 * versioned request path. The signer is isolated so the official generated SDK
 * can replace this transport without changing observation/domain contracts.
 */
export function signTikTokShopRequest(input: {
  path: string;
  query: Record<string, string>;
  bodyText?: string;
  appSecret: string;
}): string {
  if (!input.path.startsWith("/")) throw new Error("TIKTOK_SIGN_PATH_INVALID");
  const entries = Object.entries(input.query)
    .filter(([key]) => key !== "sign" && key !== "access_token")
    .sort(([a], [b]) => a.localeCompare(b));
  const parameterString = entries.map(([key, value]) => `${key}${value}`).join("");
  const payload = `${input.appSecret}${input.path}${parameterString}${input.bodyText ?? ""}${input.appSecret}`;
  return createHmac("sha256", input.appSecret).update(payload, "utf8").digest("hex");
}

export function resolveTikTokShopLiveConfig(
  env: NodeJS.ProcessEnv = process.env,
): TikTokShopLiveConfig | undefined {
  const values = {
    appKey: env.TIKTOK_SHOP_APP_KEY?.trim(),
    appSecret: env.TIKTOK_SHOP_APP_SECRET?.trim(),
    accessToken: env.TIKTOK_SHOP_ACCESS_TOKEN?.trim(),
    shopCipher: env.TIKTOK_SHOP_CIPHER?.trim(),
    shopRegion: env.TIKTOK_SHOP_REGION?.trim(),
    accountRef: env.TIKTOK_SHOP_ACCOUNT_REF?.trim(),
  };
  if (Object.values(values).some((value) => !value)) return undefined;
  return {
    appKey: values.appKey!,
    appSecret: values.appSecret!,
    accessToken: values.accessToken!,
    shopCipher: values.shopCipher!,
    shopRegion: values.shopRegion!,
    accountRef: values.accountRef!,
    baseUrl: env.TIKTOK_SHOP_API_BASE_URL?.trim() || undefined,
  };
}

export function buildTikTokCapabilityObservation(input: {
  authorization: TikTokAuthorizationObservation;
  creatorType?: TikTokShopCapabilityObservation["creatorType"];
  pilotState?: TikTokShopCapabilityObservation["pilotState"];
  dailyShoppableVideoLimit?: number;
  weeklyShoppableLiveLimit?: number;
  campaignEligible?: boolean;
  productMarketplaceEligible?: boolean;
  creatorHealthRating?: number;
}): TikTokShopCapabilityObservation {
  if (!input.authorization.authorized) throw new Error("TIKTOK_CAPABILITY_REQUIRES_AUTHORIZED_SHOP");
  return Object.freeze({
    observationId: `tiktok-capability:${input.authorization.accountRef}:${Date.parse(input.authorization.observedAt)}`,
    accountRef: input.authorization.accountRef,
    region: input.authorization.shopRegion,
    creatorType: input.creatorType ?? "unknown",
    pilotState: input.pilotState ?? "unknown",
    dailyShoppableVideoLimit: input.dailyShoppableVideoLimit,
    weeklyShoppableLiveLimit: input.weeklyShoppableLiveLimit,
    campaignEligible: input.campaignEligible,
    productMarketplaceEligible: input.productMarketplaceEligible,
    creatorHealthRating: input.creatorHealthRating,
    sourceRef: input.authorization.sourceRef,
    evidenceRefs: input.authorization.evidenceRefs,
    observedAt: input.authorization.observedAt,
  });
}

export function buildTikTokProductObservation(input: {
  snapshot: TikTokProductSnapshot;
  shopRef: string;
  observedAt: string;
  listingUrl?: string;
  unitsSold?: number;
  gmv?: { value: number; currency: string };
  weeklyGmvGrowthRate?: number;
  creatorCount?: number;
  shoppableContentCount?: number;
  commissionRate?: number;
  commissionValuePerOrder?: { value: number; currency: string };
  evidenceRefs: readonly string[];
}): TikTokShopProductObservation {
  const price = chooseProductPrice(input.snapshot);
  if (!price) throw new Error("TIKTOK_LIVE_PRODUCT_PRICE_UNAVAILABLE");
  return Object.freeze({
    observationId: `tiktok-product:${input.snapshot.productId}:${Date.parse(input.observedAt)}`,
    source: "tiktok_shop",
    provider: "tiktok-shop-open-api",
    productRef: input.snapshot.productId,
    productName: input.snapshot.title,
    shopRef: input.shopRef,
    category: input.snapshot.category,
    listingUrl: input.listingUrl,
    price: moneyMetric(price.value, price.currency, `tiktok-product:${input.snapshot.productId}:sku-price`),
    unitsSold: numberMetric(input.unitsSold, "provider_reported", `tiktok-product:${input.snapshot.productId}:units`),
    gmv: input.gmv ? moneyMetric(input.gmv.value, input.gmv.currency, `tiktok-product:${input.snapshot.productId}:gmv`) : undefined,
    weeklyGmvGrowthRate: numberMetric(input.weeklyGmvGrowthRate, "provider_reported", `tiktok-product:${input.snapshot.productId}:growth`),
    creatorCount: numberMetric(input.creatorCount, "provider_reported", `tiktok-product:${input.snapshot.productId}:creators`),
    shoppableContentCount: numberMetric(input.shoppableContentCount, "provider_reported", `tiktok-product:${input.snapshot.productId}:content`),
    commissionRate: numberMetric(input.commissionRate, "provider_reported", `tiktok-product:${input.snapshot.productId}:commission-rate`),
    commissionValuePerOrder: input.commissionValuePerOrder
      ? moneyMetric(
          input.commissionValuePerOrder.value,
          input.commissionValuePerOrder.currency,
          `tiktok-product:${input.snapshot.productId}:commission-value`,
        )
      : undefined,
    listedAt: input.snapshot.createdAt,
    creatorContributions: Object.freeze([]),
    evidenceRefs: Object.freeze([...new Set(input.evidenceRefs)]),
    observedAt: input.observedAt,
  });
}

export function buildTikTokOfferObservations(input: {
  activity: TikTokPromotionActivitySnapshot;
  productRef: string;
  observedAt: string;
  sourceRef: string;
  evidenceRefs: readonly string[];
}): TikTokOfferObservation[] {
  const product = input.activity.products.find((item) => item.id === input.productRef);
  if (!product) return [];
  const state =
    input.activity.status === "ONGOING"
      ? "active"
      : ["EXPIRED", "DEACTIVATED", "NOT_EFFECTIVE"].includes(input.activity.status)
        ? "inactive"
        : "unknown";
  const validFrom = input.activity.beginTime ? new Date(input.activity.beginTime * 1000).toISOString() : undefined;
  const validUntil = input.activity.endTime ? new Date(input.activity.endTime * 1000).toISOString() : undefined;

  if (input.activity.activityType === "DIRECT_DISCOUNT" && product.discount !== undefined) {
    const percent = Number(product.discount) / 100;
    if (!Number.isFinite(percent) || percent < 0 || percent > 1) return [];
    return [Object.freeze({
      observationId: `tiktok-offer:${input.activity.activityId}:${input.productRef}`,
      productRef: input.productRef,
      offerRef: input.activity.activityId,
      kind: "discount_percent" as const,
      displayText: `${product.discount}% off`,
      state,
      percentOff: {
        value: percent,
        provenance: "provider_reported" as const,
        sourceRef: input.sourceRef,
      },
      validFrom,
      validUntil,
      sourceRef: input.sourceRef,
      evidenceRefs: Object.freeze([...new Set(input.evidenceRefs)]),
      observedAt: input.observedAt,
    })];
  }

  if (product.activityPrice) {
    const amount = Number(product.activityPrice.amount);
    if (!Number.isFinite(amount) || amount < 0) return [];
    return [Object.freeze({
      observationId: `tiktok-offer:${input.activity.activityId}:${input.productRef}`,
      productRef: input.productRef,
      offerRef: input.activity.activityId,
      kind: "sale_price" as const,
      displayText: `${product.activityPrice.currency} ${product.activityPrice.amount}`,
      state,
      salePrice: {
        value: amount,
        currency: product.activityPrice.currency,
        provenance: "provider_reported" as const,
        sourceRef: input.sourceRef,
      },
      validFrom,
      validUntil,
      sourceRef: input.sourceRef,
      evidenceRefs: Object.freeze([...new Set(input.evidenceRefs)]),
      observedAt: input.observedAt,
    })];
  }
  return [];
}

function mapAuthorizedShop(raw: Record<string, unknown>): TikTokAuthorizedShop {
  return {
    id: readString(raw, "id") ?? readString(raw, "shop_id"),
    cipher: readString(raw, "cipher") ?? readString(raw, "shop_cipher"),
    code: readString(raw, "code") ?? readString(raw, "shop_code"),
    name: readString(raw, "name") ?? readString(raw, "shop_name"),
    region: readString(raw, "region") ?? readString(raw, "shop_region"),
    raw,
  };
}

function mapProductSnapshot(raw: Record<string, unknown>): TikTokProductSnapshot {
  const productId = requireText(
    readString(raw, "id") ?? readString(raw, "product_id") ?? "",
    "TIKTOK_LIVE_PRODUCT_ID_MISSING",
  );
  const title = requireText(
    readString(raw, "title") ?? readString(raw, "name") ?? "",
    "TIKTOK_LIVE_PRODUCT_TITLE_MISSING",
  );
  const skus = firstArray(raw, ["skus", "sku_list"]).map((sku) => ({
    id: readString(sku, "id") ?? readString(sku, "sku_id"),
    sellerSku: readString(sku, "seller_sku") ?? readString(sku, "sellerSku"),
    price: readMoneyObject(sku, ["price", "original_price", "list_price"]),
    salePrice: readMoneyObject(sku, ["sale_price", "salePrice"]),
    inventory: firstArray(sku, ["inventory", "inventories"]),
  }));
  return {
    productId,
    title,
    status: readString(raw, "status"),
    category: readString(raw, "category_name") ?? readString(raw, "category"),
    createdAt: unixOrIso(raw["create_time"] ?? raw["created_at"]),
    updatedAt: unixOrIso(raw["update_time"] ?? raw["updated_at"]),
    skus,
    raw,
  };
}

function mapPromotionSnapshot(raw: Record<string, unknown>): TikTokPromotionActivitySnapshot {
  return {
    activityId: requireText(
      readString(raw, "activity_id") ?? readString(raw, "id") ?? "",
      "TIKTOK_LIVE_ACTIVITY_ID_MISSING",
    ),
    title: requireText(readString(raw, "title") ?? "TikTok Shop promotion", "TIKTOK_LIVE_ACTIVITY_TITLE_MISSING"),
    activityType: requireText(readString(raw, "activity_type") ?? "UNKNOWN", "TIKTOK_LIVE_ACTIVITY_TYPE_MISSING"),
    status: requireText(readString(raw, "status") ?? "UNKNOWN", "TIKTOK_LIVE_ACTIVITY_STATUS_MISSING"),
    beginTime: readFiniteNumber(raw["begin_time"]),
    endTime: readFiniteNumber(raw["end_time"]),
    products: firstArray(raw, ["products"]).map((product) => ({
      id: readString(product, "id") ?? "",
      activityPrice: readMoneyObject(product, ["activity_price"]),
      discount: readString(product, "discount"),
    })).filter((product) => product.id),
    raw,
  };
}

function mapOrderStatement(raw: Record<string, unknown>, orderId: string): TikTokOrderStatementSnapshot {
  return {
    orderId: readString(raw, "order_id") ?? orderId,
    currency: requireText(readString(raw, "currency") ?? "", "TIKTOK_LIVE_STATEMENT_CURRENCY_MISSING"),
    revenueAmount: readString(raw, "revenue_amount"),
    feeAndTaxAmount: readString(raw, "fee_and_tax_amount"),
    shippingCostAmount: readString(raw, "shipping_cost_amount"),
    settlementAmount: readString(raw, "settlement_amount"),
    skuTransactions: firstArray(raw, ["sku_transactions"]),
    raw,
  };
}

function mapPaymentSnapshot(raw: Record<string, unknown>): TikTokPaymentSnapshot {
  const id = requireText(
    readString(raw, "payment_id") ?? readString(raw, "id") ?? readString(raw, "statement_id") ?? "",
    "TIKTOK_LIVE_PAYMENT_ID_MISSING",
  );
  return {
    id,
    status: readString(raw, "status"),
    amount: readMoneyObject(raw, ["amount", "payment_amount"]),
    settlementAmount: readMoneyObject(raw, ["settlement_amount"]),
    paidTime: readFiniteNumber(raw["paid_time"]),
    raw,
  };
}

function chooseProductPrice(snapshot: TikTokProductSnapshot): { value: number; currency: string } | undefined {
  for (const sku of snapshot.skus) {
    const price = sku.salePrice ?? sku.price;
    if (!price) continue;
    const value = Number(price.amount);
    if (Number.isFinite(value) && value >= 0 && price.currency.trim()) {
      return { value, currency: price.currency.trim().toUpperCase() };
    }
  }
  return undefined;
}

function moneyMetric(value: number, currency: string, sourceRef: string): TikTokMoneyMetric {
  return {
    value,
    currency: currency.trim().toUpperCase(),
    provenance: "provider_reported",
    sourceRef,
  };
}

function numberMetric(
  value: number | undefined,
  provenance: "provider_reported",
  sourceRef: string,
) {
  return value === undefined ? undefined : { value, provenance, sourceRef };
}

function firstArray(record: Record<string, unknown>, keys: string[]): Record<string, unknown>[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => isRecord(item));
    }
  }
  return [];
}

function readMoneyObject(record: Record<string, unknown>, keys: string[]): { amount: string; currency: string } | undefined {
  for (const key of keys) {
    const value = record[key];
    if (!isRecord(value)) continue;
    const amount = readString(value, "amount") ?? readString(value, "value");
    const currency = readString(value, "currency");
    if (amount && currency) return { amount, currency };
  }
  return undefined;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function unixOrIso(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value * 1000).toISOString();
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && /^\d+$/.test(value.trim())) return new Date(numeric * 1000).toISOString();
    if (Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireText(value: string, code: string): string {
  if (!value.trim()) throw new Error(code);
  return value.trim();
}

function safeMessage(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").slice(0, 300);
}
