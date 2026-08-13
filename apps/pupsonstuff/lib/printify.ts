// lib/printify.ts
//
// Server-only. Never import this from a client component — it reads
// process.env.PRINTIFY_API_KEY, which must never reach the browser.
//
// A second fulfillment-provider client, alongside the Printful account
// this project actually ships against today (see data/hotspots.ts's
// header comment: "The schema is provider-agnostic (`provider` field)
// so this can point at Printify per-hotspot later without touching any
// component" — `FulfillmentProvider` already includes "printify" as a
// valid value, unused until now). This file is that "later": a real
// Printify API client, not a redesign of the existing fulfillment
// schema — `data/hotspots.ts`'s `FulfillmentMapping`/`InventoryVariant`
// types are untouched.
//
// Built directly from Printify's own OpenAPI 3.0.3 spec (the user
// supplied the actual spec file — every endpoint path, auth header,
// query param name, and request/response shape below is transcribed
// from it, not guessed or reconstructed from memory of the public
// docs site). Endpoints covered: Shops, Catalog (blueprints/print
// providers/variants/shipping), Products (CRUD + publish lifecycle),
// Orders (submit/list/get/cancel/shipping calc), Uploads. Webhooks and
// the V2 shipping-by-variant endpoints from the spec are NOT
// implemented here — nothing in this app subscribes to Printify
// webhooks or needs per-variant V2 shipping yet; add them the same way
// (spec -> typed function) if that changes.
//
// UNTESTED against a live key — no network access to api.printify.com
// from the sandbox that wrote this, same honest caveat as every other
// external API integration in this project (lib/ai.ts, lib/animation.ts,
// lib/muapi.ts). Treat the first real call as a test: confirm the
// response shapes below still match Printify's current API before
// trusting this in production, since (per those other files' own
// caveats) external APIs do change over time.

const BASE_URL = "https://api.printify.com";

// ---------------------------------------------------------------------
// Shared request plumbing
// ---------------------------------------------------------------------

export interface PrintifyErrorDetails {
  reason?: string;
  code?: number;
}

export interface PrintifyErrorResponse {
  status?: string;
  code?: number;
  message: string;
  errors?: PrintifyErrorDetails;
}

/** Thrown by every function below on a non-2xx response. Carries the
 * parsed error body (per the spec's `errorResponse` schema) when the API
 * returned one, so callers can inspect `.code`/`.details` rather than
 * just a message string. */
export class PrintifyApiError extends Error {
  status: number;
  details?: PrintifyErrorDetails;
  constructor(status: number, body: PrintifyErrorResponse | string) {
    const message =
      typeof body === "string" ? body : body.message || "Printify API error";
    super(message);
    this.name = "PrintifyApiError";
    this.status = status;
    this.details = typeof body === "string" ? undefined : body.errors;
  }
}

function requireApiKey(): string {
  const key = process.env.PRINTIFY_API_KEY;
  if (!key) {
    throw new PrintifyApiError(0, "PRINTIFY_API_KEY is not configured.");
  }
  return key;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

async function printifyFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const apiKey = requireApiKey();
  const url = new URL(BASE_URL + path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: {
      // Bearer auth, per the spec's `bearerAuth` security scheme
      // (http/bearer) — not a custom header the way Muapi.ai's client
      // (lib/muapi.ts) uses `x-api-key`. Two different providers, two
      // different real conventions; don't assume they match.
      Authorization: `Bearer ${apiKey}`,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new PrintifyApiError(res.status, data ?? text);
  }
  return data as T;
}

// ---------------------------------------------------------------------
// Shared types (transcribed from the spec's `components.schemas`)
// ---------------------------------------------------------------------

export interface PrintifyShop {
  id: number;
  title: string;
  sales_channel: string;
}

export interface PrintifyBlueprint {
  id: number;
  title: string;
  description: string | null;
  brand: string;
  model: string;
  images: string[];
}

export interface PrintifyPrintProviderSimple {
  id: number;
  title: string;
  decoration_methods: string[];
}

export interface PrintifyLocation {
  address1: string | null;
  address2: string | null;
  city: string;
  country: string;
  region: string;
  zip: string;
}

export interface PrintifyPrintProvider {
  id: number;
  title: string;
  location: PrintifyLocation;
  blueprints?: PrintifyBlueprint[];
}

export interface PrintifyVariantOptions {
  color?: string;
  size?: string;
}

export interface PrintifyVariantPlaceholder {
  position: string;
  decoration_method: string;
  height: number;
  width: number;
}

export interface PrintifyCatalogVariant {
  id: number;
  title: string;
  options: PrintifyVariantOptions;
  placeholders: PrintifyVariantPlaceholder[];
  decoration_methods: string[];
}

export interface PrintifyVariantsResponse {
  id: number;
  title: string;
  variants: PrintifyCatalogVariant[];
}

export interface PrintifyHandlingTime {
  value: number;
  unit: string;
}

export interface PrintifyShippingCost {
  cost: number;
  currency: string;
}

export interface PrintifyShippingProfile {
  variant_ids: number[];
  first_item: PrintifyShippingCost;
  additional_items: PrintifyShippingCost;
  countries: string[];
}

export interface PrintifyShippingInfo {
  handling_time: PrintifyHandlingTime;
  profiles: PrintifyShippingProfile[];
}

export interface PrintifyPaginated<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number | null;
  last_page: number;
  last_page_url: string;
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number | null;
  total: number;
}

// -- Uploads --

export interface PrintifyUpload {
  id: string;
  file_name: string;
  height: number;
  width: number;
  size: number;
  mime_type: string;
  preview_url: string;
  upload_time: string;
}

export type UploadImageRequest =
  | { file_name: string; url: string }
  | { file_name: string; contents: string }; // base64-encoded

// -- Products --

export interface PrintifyProductVariantInput {
  id: number;
  price: number; // cents
  is_enabled: boolean;
}

export interface PrintifyPlaceholderImage {
  id: string;
  x: number;
  y: number;
  scale: number;
  angle: number;
}

export interface PrintifyPrintAreaPlaceholder {
  position: string;
  images: PrintifyPlaceholderImage[];
}

export interface PrintifyPrintAreaInput {
  variant_ids: number[];
  placeholders: PrintifyPrintAreaPlaceholder[];
  background?: string;
}

export interface CreateProductRequest {
  title: string;
  description?: string | null;
  safety_information?: string | null;
  blueprint_id: number;
  print_provider_id: number;
  variants: PrintifyProductVariantInput[];
  print_areas: PrintifyPrintAreaInput[];
}

export interface PrintifyProductVariant {
  id: number;
  sku: string;
  cost: number;
  price: number;
  title: string;
  grams?: number;
  is_enabled: boolean;
  is_default?: boolean;
  is_available?: boolean;
}

export interface PrintifyProductImage {
  src: string;
  variant_ids: number[];
  position: string;
  is_default?: boolean;
}

export interface PrintifyProduct {
  id: string;
  title: string;
  description: string | null;
  safety_information?: string | null;
  tags: string[];
  variants: PrintifyProductVariant[];
  images: PrintifyProductImage[];
  created_at: string;
  updated_at: string;
  visible: boolean;
  blueprint_id: number;
  shop_id: number;
  print_provider_id: number;
}

export interface PublishRequest {
  title?: boolean;
  description?: boolean;
  images?: boolean;
  variants?: boolean;
  tags?: boolean;
  keyFeatures?: boolean;
  shipping_template?: boolean;
}

// -- Orders --

export interface PrintifyAddressTo {
  first_name: string;
  last_name: string;
  region?: string | null;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
  email: string;
  phone: string;
  country: string;
  company?: string | null;
}

/** One of three shapes, per the spec's `lineItem` oneOf — a Printify
 * product you've already created, a raw blueprint+variant (Printify
 * builds the product implicitly), or a plain SKU lookup. */
export type PrintifyLineItem =
  | { product_id: string; variant_id: number; quantity: number; external_id?: string | null }
  | {
      print_provider_id: number;
      blueprint_id: number;
      variant_id: number;
      quantity: number;
      print_areas?: Record<string, string>;
      external_id?: string | null;
    }
  | { sku: string; quantity: number; external_id?: string | null };

export interface SubmitOrderRequest {
  external_id?: string | null;
  label?: string | null;
  line_items: PrintifyLineItem[];
  shipping_method?: number | null;
  is_printify_express?: boolean | null;
  is_economy_shipping?: boolean | null;
  send_shipping_notification?: boolean | null;
  address_to: PrintifyAddressTo;
}

export interface PrintifyOrderCreated {
  id: string;
}

export interface PrintifyShipment {
  carrier: string;
  number: string;
  url: string;
  delivered_at: string | null;
}

export interface PrintifyOrderLineItem {
  product_id: string;
  quantity: number;
  variant_id: number;
  print_provider_id: number;
  cost: number;
  shipping_cost: number;
  status: string;
  sent_to_production_at: string | null;
  fulfilled_at: string | null;
}

export interface PrintifyOrder {
  id: string;
  app_order_id: string | null;
  address_to: PrintifyAddressTo;
  line_items: PrintifyOrderLineItem[];
  total_price: number;
  total_shipping: number;
  total_tax: number;
  status: string;
  shipping_method: number;
  is_printify_express: boolean;
  is_economy_shipping: boolean;
  shipments: PrintifyShipment[];
  created_at: string;
  sent_to_production_at: string | null;
  fulfilled_at: string | null;
}

export interface PrintifyShippingCosts {
  standard: number;
  express: number;
  priority: number;
  printify_express: number;
  economy: number;
}

export interface CalculateShippingRequest {
  line_items: PrintifyLineItem[];
  address_to: PrintifyAddressTo;
}

// ---------------------------------------------------------------------
// Shops — GET /v1/shops.json, DELETE /v1/shops/{shop_id}/connection.json
// ---------------------------------------------------------------------

export function listShops(): Promise<PrintifyShop[]> {
  return printifyFetch<PrintifyShop[]>("/v1/shops.json");
}

export function disconnectShop(shopId: string | number): Promise<void> {
  return printifyFetch<void>(`/v1/shops/${shopId}/connection.json`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------
// Catalog — GET /v1/catalog/blueprints*.json, print_providers*.json
// ---------------------------------------------------------------------

export function listBlueprints(): Promise<PrintifyBlueprint[]> {
  return printifyFetch<PrintifyBlueprint[]>("/v1/catalog/blueprints.json");
}

export function getBlueprint(blueprintId: string | number): Promise<PrintifyBlueprint> {
  return printifyFetch<PrintifyBlueprint>(`/v1/catalog/blueprints/${blueprintId}.json`);
}

export function listPrintProviders(): Promise<PrintifyPrintProvider[]> {
  return printifyFetch<PrintifyPrintProvider[]>("/v1/catalog/print_providers.json");
}

export function getPrintProvider(
  printProviderId: string | number
): Promise<PrintifyPrintProvider> {
  return printifyFetch<PrintifyPrintProvider>(
    `/v1/catalog/print_providers/${printProviderId}.json`
  );
}

export function listPrintProvidersForBlueprint(
  blueprintId: string | number
): Promise<PrintifyPrintProviderSimple[]> {
  return printifyFetch<PrintifyPrintProviderSimple[]>(
    `/v1/catalog/blueprints/${blueprintId}/print_providers.json`
  );
}

export function listVariants(
  blueprintId: string | number,
  printProviderId: string | number,
  opts: { showOutOfStock?: boolean } = {}
): Promise<PrintifyVariantsResponse> {
  return printifyFetch<PrintifyVariantsResponse>(
    `/v1/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
    {
      // Spec's query param name has a trailing space in its `name` field
      // ("show-out-of-stock "), which is very likely a typo in Printify's
      // own spec rather than a real requirement — sending the trimmed,
      // sane version. If a live call proves the literal trailing-space
      // key is actually required, that's a real, surprising finding
      // worth flagging back rather than silently "fixing" forever.
      query: { "show-out-of-stock": opts.showOutOfStock ? "1" : "0" },
    }
  );
}

export function getBlueprintShipping(
  blueprintId: string | number
): Promise<PrintifyShippingInfo> {
  return printifyFetch<PrintifyShippingInfo>(
    `/v1/catalog/blueprints/${blueprintId}/print_providers/shipping.json`
  );
}

// ---------------------------------------------------------------------
// Uploads — /v1/uploads*.json
// ---------------------------------------------------------------------

export function listUploads(
  opts: { limit?: number; page?: number } = {}
): Promise<PrintifyPaginated<PrintifyUpload>> {
  return printifyFetch<PrintifyPaginated<PrintifyUpload>>("/v1/uploads.json", {
    query: { limit: opts.limit, page: opts.page },
  });
}

export function getUpload(imageId: string): Promise<PrintifyUpload> {
  return printifyFetch<PrintifyUpload>(`/v1/uploads/${imageId}.json`);
}

/** Uploads by URL or by base64 contents — the spec's `uploadImageRequest`
 * oneOf. Uploading the AI-generated portrait (already base64 from
 * lib/ai.ts/lib/muapi.ts) means the `contents` branch, not `url` — this
 * app never has a public URL for a generated image, only in-memory
 * base64 data. */
export function uploadImage(req: UploadImageRequest): Promise<PrintifyUpload> {
  return printifyFetch<PrintifyUpload>("/v1/uploads/images.json", {
    method: "POST",
    body: req,
  });
}

export function archiveUpload(imageId: string): Promise<void> {
  return printifyFetch<void>(`/v1/uploads/${imageId}/archive.json`, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------
// Products — /v1/shops/{shop_id}/products*.json
// ---------------------------------------------------------------------

export function listProducts(
  shopId: string | number,
  opts: { limit?: number; page?: number } = {}
): Promise<PrintifyPaginated<PrintifyProduct>> {
  return printifyFetch<PrintifyPaginated<PrintifyProduct>>(
    `/v1/shops/${shopId}/products.json`,
    { query: { limit: opts.limit, page: opts.page } }
  );
}

export function getProduct(
  shopId: string | number,
  productId: string
): Promise<PrintifyProduct> {
  return printifyFetch<PrintifyProduct>(`/v1/shops/${shopId}/products/${productId}.json`);
}

export function createProduct(
  shopId: string | number,
  req: CreateProductRequest
): Promise<PrintifyProduct> {
  return printifyFetch<PrintifyProduct>(`/v1/shops/${shopId}/products.json`, {
    method: "POST",
    body: req,
  });
}

export function updateProduct(
  shopId: string | number,
  productId: string,
  req: Partial<CreateProductRequest>
): Promise<PrintifyProduct> {
  return printifyFetch<PrintifyProduct>(`/v1/shops/${shopId}/products/${productId}.json`, {
    method: "PUT",
    body: req,
  });
}

export function deleteProduct(shopId: string | number, productId: string): Promise<void> {
  return printifyFetch<void>(`/v1/shops/${shopId}/products/${productId}.json`, {
    method: "DELETE",
  });
}

export function publishProduct(
  shopId: string | number,
  productId: string,
  req: PublishRequest
): Promise<void> {
  return printifyFetch<void>(`/v1/shops/${shopId}/products/${productId}/publish.json`, {
    method: "POST",
    body: req,
  });
}

// ---------------------------------------------------------------------
// Orders — /v1/shops/{shop_id}/orders*.json
// ---------------------------------------------------------------------

export function listOrders(
  shopId: string | number,
  opts: { limit?: number; page?: number; status?: string; sku?: string } = {}
): Promise<PrintifyPaginated<PrintifyOrder>> {
  return printifyFetch<PrintifyPaginated<PrintifyOrder>>(`/v1/shops/${shopId}/orders.json`, {
    query: { limit: opts.limit, page: opts.page, status: opts.status, sku: opts.sku },
  });
}

export function getOrder(shopId: string | number, orderId: string): Promise<PrintifyOrder> {
  return printifyFetch<PrintifyOrder>(`/v1/shops/${shopId}/orders/${orderId}.json`);
}

export function submitOrder(
  shopId: string | number,
  req: SubmitOrderRequest
): Promise<PrintifyOrderCreated> {
  return printifyFetch<PrintifyOrderCreated>(`/v1/shops/${shopId}/orders.json`, {
    method: "POST",
    body: req,
  });
}

export function cancelOrder(
  shopId: string | number,
  orderId: string
): Promise<PrintifyOrder> {
  return printifyFetch<PrintifyOrder>(`/v1/shops/${shopId}/orders/${orderId}/cancel.json`, {
    method: "POST",
  });
}

export function sendOrderToProduction(
  shopId: string | number,
  orderId: string
): Promise<PrintifyOrderCreated> {
  return printifyFetch<PrintifyOrderCreated>(
    `/v1/shops/${shopId}/orders/${orderId}/send_to_production.json`,
    { method: "POST" }
  );
}

export function calculateShipping(
  shopId: string | number,
  req: CalculateShippingRequest
): Promise<PrintifyShippingCosts> {
  return printifyFetch<PrintifyShippingCosts>(`/v1/shops/${shopId}/orders/shipping.json`, {
    method: "POST",
    body: req,
  });
}
