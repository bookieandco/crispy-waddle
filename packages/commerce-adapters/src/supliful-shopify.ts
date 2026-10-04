import type {
  SupplierProcurementAdapter,
  SupplierProcurementPrepareRequest,
  SupplierProcurementPreview,
  SupplierProcurementResult,
} from "./supplier";

export const SUPLIFUL_SHOPIFY_FULFILLMENT_SERVICE = "Supliful Fulfillment" as const;
export const SUPLIFUL_SHOPIFY_PROVIDER = "supliful_shopify" as const;
export const SHOPIFY_ADMIN_API_VERSION = "2026-10" as const;

export interface SuplifulShopifyProductBinding {
  internalProductId: string;
  internalVariantId: string;
  shopifyProductGid: string;
  shopifyVariantGid: string;
  sku?: string;
  fulfillmentServiceName: string;
  observedAt: string;
}

export interface SuplifulShopifyProductBindingResolver {
  resolveProductBinding(input: {
    actorId: string;
    internalProductId: string;
    internalVariantId: string;
  }): Promise<SuplifulShopifyProductBinding | null>;
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

export interface SuplifulShopifyDeliveryAddress {
  firstName?: string;
  lastName?: string;
  name?: string;
  address1: string;
  address2?: string;
  city: string;
  provinceCode?: string;
  countryCode: string;
  zip: string;
  phone?: string;
}

export interface SuplifulShopifyPaidOrder {
  internalOrderId: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress: SuplifulShopifyDeliveryAddress;
  paidAt: string;
  paymentEvidenceRefs: string[];
}

export interface SuplifulShopifyPaidOrderResolver {
  resolvePaidOrder(input: {
    actorId: string;
    internalOrderId: string;
    internalOrderItemId: string;
  }): Promise<SuplifulShopifyPaidOrder | null>;
}

export interface SuplifulShopifyRemoteOrder {
  id: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  displayFinancialStatus?: string;
  displayFulfillmentStatus?: string;
  sourceIdentifier?: string;
  customAttributes?: Array<{ key: string; value: string }>;
  fulfillmentOrders?: Array<{
    id: string;
    status?: string;
  }>;
  fulfillments?: Array<{
    id: string;
    status?: string;
    trackingInfo?: Array<{
      company?: string;
      number?: string;
      url?: string;
    }>;
  }>;
}

export interface SuplifulShopifyAdminClient {
  findOrderBySourceIdentifier(sourceIdentifier: string): Promise<SuplifulShopifyRemoteOrder | null>;
  createPaidOrder(input: {
    sourceIdentifier: string;
    internalOrderId: string;
    internalOrderItemId: string;
    supplierId: string;
    connectionId: string;
    productId: string;
    inventoryId: string;
    variantGid: string;
    quantity: number;
    customerEmail: string;
    customerPhone?: string;
    shippingAddress: SuplifulShopifyDeliveryAddress;
    paidAt: string;
  }): Promise<SuplifulShopifyRemoteOrder>;
}

export interface ShopifyAdminGraphqlClientOptions {
  shopDomain: string;
  accessToken: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Minimal Shopify Admin GraphQL transport used by the Supliful procurement
 * adapter. It creates only already-paid upstream orders and recovers them by
 * sourceIdentifier before any retry.
 */
export class ShopifyAdminGraphqlClient implements SuplifulShopifyAdminClient {
  private readonly shopDomain: string;
  private readonly accessToken: string;
  private readonly apiVersion: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ShopifyAdminGraphqlClientOptions) {
    this.shopDomain = normalizeShopDomain(options.shopDomain);
    this.accessToken = requireText(options.accessToken, "Shopify Admin access token");
    this.apiVersion = requireText(options.apiVersion ?? SHOPIFY_ADMIN_API_VERSION, "Shopify API version");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async findOrderBySourceIdentifier(
    sourceIdentifier: string,
  ): Promise<SuplifulShopifyRemoteOrder | null> {
    const identifier = requireText(sourceIdentifier, "sourceIdentifier");
    const data = await this.graphql<{
      orders?: { nodes?: SuplifulShopifyRemoteOrder[] };
    }>(
      `query FindJhadinaSupplierOrder($query: String!) {
        orders(first: 2, query: $query, sortKey: CREATED_AT, reverse: true) {
          nodes {
            id
            name
            createdAt
            updatedAt
            displayFinancialStatus
            displayFulfillmentStatus
            sourceIdentifier
            customAttributes { key value }
            fulfillmentOrders(first: 5) { nodes { id status } }
            fulfillments(first: 5) {
              id
              status
              trackingInfo { company number url }
            }
          }
        }
      }`,
      { query: `source_identifier:"${escapeShopifySearch(identifier)}"` },
    );
    const rows = data.orders?.nodes ?? [];
    if (rows.length > 1) {
      throw new Error("Shopify returned multiple orders for one Jhadina source identifier");
    }
    return rows[0] ? normalizeRemoteOrder(rows[0]) : null;
  }

  async createPaidOrder(input: {
    sourceIdentifier: string;
    internalOrderId: string;
    internalOrderItemId: string;
    supplierId: string;
    connectionId: string;
    productId: string;
    inventoryId: string;
    variantGid: string;
    quantity: number;
    customerEmail: string;
    customerPhone?: string;
    shippingAddress: SuplifulShopifyDeliveryAddress;
    paidAt: string;
  }): Promise<SuplifulShopifyRemoteOrder> {
    assertShopifyGid(input.variantGid, "ProductVariant");
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new Error("Shopify order quantity must be a positive integer");
    }
    assertEmail(input.customerEmail);
    assertDeliveryAddress(input.shippingAddress);
    assertTimestamp(input.paidAt);

    const data = await this.graphql<{
      orderCreate?: {
        userErrors?: Array<{ field?: string[]; message: string }>;
        order?: SuplifulShopifyRemoteOrder | null;
      };
    }>(
      `mutation CreateJhadinaSupplierOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
        orderCreate(order: $order, options: $options) {
          userErrors { field message }
          order {
            id
            name
            createdAt
            updatedAt
            displayFinancialStatus
            displayFulfillmentStatus
            sourceIdentifier
            customAttributes { key value }
            fulfillmentOrders(first: 5) { nodes { id status } }
            fulfillments(first: 5) {
              id
              status
              trackingInfo { company number url }
            }
          }
        }
      }`,
      {
        order: {
          sourceIdentifier: requireText(input.sourceIdentifier, "sourceIdentifier"),
          sourceName: "Jhadina",
          processedAt: input.paidAt,
          financialStatus: "PAID",
          email: input.customerEmail,
          phone: input.customerPhone,
          shippingAddress: toShopifyMailingAddress(input.shippingAddress),
          lineItems: [{ variantId: input.variantGid, quantity: input.quantity }],
          customAttributes: [
            { key: "jhadina_internal_order_id", value: input.internalOrderId },
            { key: "jhadina_internal_order_item_id", value: input.internalOrderItemId },
            { key: "jhadina_supplier_id", value: input.supplierId },
            { key: "jhadina_connection_id", value: input.connectionId },
            { key: "jhadina_product_id", value: input.productId },
            { key: "jhadina_inventory_id", value: input.inventoryId },
            { key: "jhadina_quantity", value: String(input.quantity) },
            { key: "jhadina_source_identifier", value: input.sourceIdentifier },
          ],
        },
        options: {
          sendReceipt: false,
          sendFulfillmentReceipt: false,
        },
      },
    );
    const payload = data.orderCreate;
    const errors = payload?.userErrors ?? [];
    if (errors.length) {
      throw new Error(
        `Shopify orderCreate rejected: ${errors.map((row) => row.message).join("; ")}`,
      );
    }
    if (!payload?.order) throw new Error("Shopify orderCreate returned no order");
    return normalizeRemoteOrder(payload.order);
  }

  private async graphql<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const response = await this.fetchImpl(
      `https://${this.shopDomain}/admin/api/${this.apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-shopify-access-token": this.accessToken,
        },
        body: JSON.stringify({ query, variables }),
      },
    );
    const text = await response.text();
    let parsed: {
      data?: T;
      errors?: Array<{ message?: string }>;
    };
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      throw new Error(`Shopify GraphQL returned non-JSON HTTP ${response.status}`);
    }
    if (!response.ok) {
      throw new Error(
        `Shopify GraphQL HTTP ${response.status}: ${parsed.errors?.map((row) => row.message).filter(Boolean).join("; ") || "request failed"}`,
      );
    }
    if (parsed.errors?.length) {
      throw new Error(
        `Shopify GraphQL error: ${parsed.errors.map((row) => row.message ?? "unknown error").join("; ")}`,
      );
    }
    if (!parsed.data) throw new Error("Shopify GraphQL response did not include data");
    return parsed.data;
  }
}

export interface SuplifulShopifySupplierProcurementAdapterOptions {
  client: SuplifulShopifyAdminClient;
  paidOrderResolver: SuplifulShopifyPaidOrderResolver;
  productBindingResolver: SuplifulShopifyProductBindingResolver;
  previewTtlMs?: number;
  now?: () => Date;
}

/**
 * Live-provider-capable Supliful transport through Shopify Admin GraphQL.
 *
 * PII is deliberately absent from SupplierProcurementPreview. Shipping/contact
 * data is resolved only after the existing Commerce proposal is approved and
 * execution enters submit(). An ambiguous create result is recovered by the
 * same deterministic sourceIdentifier before any retry.
 */
export class SuplifulShopifySupplierProcurementAdapter
implements SupplierProcurementAdapter {
  readonly name = SUPLIFUL_SHOPIFY_PROVIDER;
  private readonly client: SuplifulShopifyAdminClient;
  private readonly paidOrderResolver: SuplifulShopifyPaidOrderResolver;
  private readonly productBindingResolver: SuplifulShopifyProductBindingResolver;
  private readonly previewTtlMs: number;
  private readonly now: () => Date;

  constructor(options: SuplifulShopifySupplierProcurementAdapterOptions) {
    this.client = options.client;
    this.paidOrderResolver = options.paidOrderResolver;
    this.productBindingResolver = options.productBindingResolver;
    this.previewTtlMs = options.previewTtlMs ?? 15 * 60 * 1000;
    if (!Number.isFinite(this.previewTtlMs) || this.previewTtlMs <= 0) {
      throw new Error("Supliful previewTtlMs must be positive");
    }
    this.now = options.now ?? (() => new Date());
  }

  async prepare(
    request: SupplierProcurementPrepareRequest,
  ): Promise<SupplierProcurementPreview> {
    if (request.offer.provider !== SUPLIFUL_SHOPIFY_PROVIDER) {
      throw new Error("Supliful adapter requires a supliful_shopify offer");
    }
    if (request.offer.connectionId.trim().length === 0) {
      throw new Error("Supliful Shopify connectionId is required");
    }
    if (request.offer.externalProduct.provider !== "shopify") {
      throw new Error("Supliful offer external product must be a Shopify variant");
    }
    assertShopifyGid(request.offer.externalProduct.externalId, "ProductVariant");
    const binding = await this.productBindingResolver.resolveProductBinding({
      actorId: request.actorId,
      internalProductId: request.offer.productId,
      internalVariantId: request.offer.inventoryId,
    });
    if (!binding) throw new Error("Verified Supliful Shopify product binding is required");
    assertSuplifulShopifyProductBinding(binding);
    if (binding.shopifyVariantGid !== request.offer.externalProduct.externalId) {
      throw new Error("Supliful offer does not match the verified Shopify variant binding");
    }
    if (!request.offer.destinationCountries.map(normalizeCountry).some(
      (country) => country === "*" || country === normalizeCountry(request.destinationCountry),
    )) {
      throw new Error("Supliful offer does not support the requested destination");
    }
    if ((request.offer.excludedDestinationCountries ?? []).map(normalizeCountry)
      .includes(normalizeCountry(request.destinationCountry))) {
      throw new Error("Supliful offer excludes the requested destination");
    }
    if (!Number.isInteger(request.quantity) || request.quantity <= 0) {
      throw new Error("Supliful procurement quantity must be positive");
    }
    const preparedAt = this.now().toISOString();
    const totalAmountMinor =
      request.offer.unitAmountMinor * request.quantity + request.offer.shippingAmountMinor;
    return {
      previewId: `supliful-shopify-preview:${request.idempotencyKey}`,
      actorId: request.actorId,
      provider: SUPLIFUL_SHOPIFY_PROVIDER,
      connectionId: request.offer.connectionId,
      supplierId: request.offer.supplierId,
      productId: request.offer.productId,
      inventoryId: request.offer.inventoryId,
      externalProduct: request.offer.externalProduct,
      opportunityId: request.opportunityId,
      researchCaseId: request.researchCaseId,
      evidenceRefs: [...request.evidenceRefs],
      internalOrderId: request.internalOrderId,
      internalOrderItemId: request.internalOrderItemId,
      quantity: request.quantity,
      unitAmountMinor: request.offer.unitAmountMinor,
      shippingAmountMinor: request.offer.shippingAmountMinor,
      totalAmountMinor,
      currency: request.offer.currency.trim().toUpperCase(),
      destinationCountry: normalizeCountry(request.destinationCountry),
      estimatedDeliveryDays: request.offer.estimatedDeliveryDays,
      idempotencyKey: request.idempotencyKey,
      preparedAt,
      expiresAt: new Date(Date.parse(preparedAt) + this.previewTtlMs).toISOString(),
    };
  }

  async submit(preview: SupplierProcurementPreview): Promise<SupplierProcurementResult> {
    assertSuplifulPreview(preview);
    if (Date.parse(preview.expiresAt) <= this.now().getTime()) {
      throw new Error("Supliful procurement preview is expired");
    }
    const sourceIdentifier = suplifulShopifySourceIdentifier(preview.idempotencyKey);
    const existing = await this.client.findOrderBySourceIdentifier(sourceIdentifier);
    if (existing) return normalizeProcurementResult(preview, existing);

    const paidOrder = await this.paidOrderResolver.resolvePaidOrder({
      actorId: preview.actorId,
      internalOrderId: preview.internalOrderId,
      internalOrderItemId: preview.internalOrderItemId,
    });
    if (!paidOrder) throw new Error("Paid internal order could not be resolved for Supliful execution");
    if (paidOrder.internalOrderId !== preview.internalOrderId) {
      throw new Error("Resolved paid order does not match procurement preview");
    }
    if (!paidOrder.paymentEvidenceRefs.length) {
      throw new Error("Supliful execution requires paid-order evidence");
    }
    if (normalizeCountry(paidOrder.shippingAddress.countryCode) !== preview.destinationCountry) {
      throw new Error("Paid order shipping country does not match approved procurement preview");
    }

    try {
      const created = await this.client.createPaidOrder({
        sourceIdentifier,
        internalOrderId: preview.internalOrderId,
        internalOrderItemId: preview.internalOrderItemId,
        supplierId: preview.supplierId,
        connectionId: preview.connectionId,
        productId: preview.productId,
        inventoryId: preview.inventoryId,
        variantGid: preview.externalProduct.externalId,
        quantity: preview.quantity,
        customerEmail: paidOrder.customerEmail,
        customerPhone: paidOrder.customerPhone,
        shippingAddress: paidOrder.shippingAddress,
        paidAt: paidOrder.paidAt,
      });
      return normalizeProcurementResult(preview, created);
    } catch (error) {
      const recovered = await this.client.findOrderBySourceIdentifier(sourceIdentifier);
      if (recovered) return normalizeProcurementResult(preview, recovered);
      throw error;
    }
  }

  async getByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SupplierProcurementResult | null> {
    const key = requireText(idempotencyKey, "idempotencyKey");
    const order = await this.client.findOrderBySourceIdentifier(
      suplifulShopifySourceIdentifier(key),
    );
    if (!order) return null;

    // Reconciliation only has the provider order, so recover the approved
    // preview identity from the deterministic source identifier.
    const decoded = decodeSuplifulShopifySourceIdentifier(order.sourceIdentifier ?? "");
    if (decoded !== key) {
      throw new Error("Recovered Shopify order source identifier does not match idempotency key");
    }
    const attributes = customAttributeMap(order);
    const quantity = Number(attributes.jhadina_quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Recovered Shopify order is missing Jhadina quantity metadata");
    }
    const internalOrderId =
      attributes.jhadina_internal_order_id ?? internalOrderIdFromIdempotencyKey(key);
    const internalOrderItemId =
      attributes.jhadina_internal_order_item_id ?? internalOrderItemIdFromIdempotencyKey(key);
    return {
      procurementId: `supliful-shopify:${order.id}`,
      status: statusFromRemoteOrder(order),
      supplierId: requireText(attributes.jhadina_supplier_id ?? "", "recovered supplierId"),
      connectionId: requireText(attributes.jhadina_connection_id ?? "", "recovered connectionId"),
      productId: requireText(attributes.jhadina_product_id ?? "", "recovered productId"),
      inventoryId: requireText(attributes.jhadina_inventory_id ?? "", "recovered inventoryId"),
      quantity,
      internalOrderId,
      internalOrderItemId,
      idempotencyKey: key,
      externalOrder: { provider: "shopify", externalId: order.id },
      tracking: trackingReference(order),
      submittedAt: normalizeTimestamp(order.createdAt),
      updatedAt: normalizeTimestamp(order.updatedAt),
    };
  }
}

export function suplifulShopifySourceIdentifier(idempotencyKey: string): string {
  return `jhadina-${encodeURIComponent(requireText(idempotencyKey, "idempotencyKey"))}`;
}

export function decodeSuplifulShopifySourceIdentifier(value: string): string {
  const normalized = requireText(value, "sourceIdentifier");
  if (!normalized.startsWith("jhadina-")) {
    throw new Error("Shopify source identifier is not owned by Jhadina");
  }
  return decodeURIComponent(normalized.slice("jhadina-".length));
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

function assertSuplifulPreview(preview: SupplierProcurementPreview): void {
  if (preview.provider !== SUPLIFUL_SHOPIFY_PROVIDER) {
    throw new Error("Supliful adapter received a preview for another provider");
  }
  assertShopifyGid(preview.externalProduct.externalId, "ProductVariant");
}

function normalizeProcurementResult(
  preview: SupplierProcurementPreview,
  order: SuplifulShopifyRemoteOrder,
): SupplierProcurementResult {
  assertShopifyGid(order.id, "Order");
  const sourceIdentifier = decodeSuplifulShopifySourceIdentifier(order.sourceIdentifier ?? "");
  if (sourceIdentifier !== preview.idempotencyKey) {
    throw new Error("Shopify order source identifier does not match procurement preview");
  }
  return {
    procurementId: `supliful-shopify:${order.id}`,
    status: statusFromRemoteOrder(order),
    supplierId: preview.supplierId,
    connectionId: preview.connectionId,
    productId: preview.productId,
    inventoryId: preview.inventoryId,
    quantity: preview.quantity,
    internalOrderId: preview.internalOrderId,
    internalOrderItemId: preview.internalOrderItemId,
    idempotencyKey: preview.idempotencyKey,
    externalOrder: { provider: "shopify", externalId: order.id },
    tracking: trackingReference(order),
    submittedAt: normalizeTimestamp(order.createdAt),
    updatedAt: normalizeTimestamp(order.updatedAt),
  };
}

function statusFromRemoteOrder(order: SuplifulShopifyRemoteOrder): SupplierProcurementResult["status"] {
  const financial = (order.displayFinancialStatus ?? "").toUpperCase();
  if (financial === "VOIDED" || financial === "REFUNDED") return "rejected";
  const fulfillment = (order.displayFulfillmentStatus ?? "").toUpperCase();
  if (fulfillment === "FULFILLED" || trackingReference(order)) return "shipped";
  if (fulfillment === "IN_PROGRESS" || fulfillment === "PARTIALLY_FULFILLED") return "confirmed";
  return "confirmed";
}

function trackingReference(
  order: SuplifulShopifyRemoteOrder,
): SupplierProcurementResult["tracking"] {
  const tracking = order.fulfillments
    ?.flatMap((fulfillment) => fulfillment.trackingInfo ?? [])
    .find((row) => row.number?.trim());
  return tracking?.number?.trim()
    ? { provider: tracking.company?.trim() || "shopify_tracking", externalId: tracking.number.trim() }
    : undefined;
}

function normalizeRemoteOrder(order: SuplifulShopifyRemoteOrder): SuplifulShopifyRemoteOrder {
  const fulfillmentOrdersRaw = (
    order.fulfillmentOrders as unknown as { nodes?: Array<{ id: string; status?: string }> } | undefined
  )?.nodes;
  return {
    ...order,
    fulfillmentOrders: fulfillmentOrdersRaw ?? order.fulfillmentOrders ?? [],
    fulfillments: order.fulfillments ?? [],
  };
}

function customAttributeMap(order: SuplifulShopifyRemoteOrder): Record<string, string> {
  return Object.fromEntries(
    (order.customAttributes ?? [])
      .filter((row) => row.key?.trim() && typeof row.value === "string")
      .map((row) => [row.key.trim(), row.value]),
  );
}

function toShopifyMailingAddress(address: SuplifulShopifyDeliveryAddress) {
  const name = splitName(address);
  return {
    firstName: address.firstName?.trim() || name.firstName,
    lastName: address.lastName?.trim() || name.lastName,
    address1: requireText(address.address1, "shippingAddress.address1"),
    address2: address.address2?.trim() || undefined,
    city: requireText(address.city, "shippingAddress.city"),
    provinceCode: address.provinceCode?.trim() || undefined,
    countryCode: normalizeCountry(address.countryCode),
    zip: requireText(address.zip, "shippingAddress.zip"),
    phone: address.phone?.trim() || undefined,
  };
}

function splitName(address: SuplifulShopifyDeliveryAddress): {
  firstName: string;
  lastName: string;
} {
  const raw = address.name?.trim() ?? "";
  if (!raw) {
    return {
      firstName: address.firstName?.trim() || "Customer",
      lastName: address.lastName?.trim() || "Order",
    };
  }
  const parts = raw.split(/\s+/);
  return {
    firstName: parts.shift() || "Customer",
    lastName: parts.join(" ") || "Order",
  };
}

function assertDeliveryAddress(address: SuplifulShopifyDeliveryAddress): void {
  requireText(address.address1, "shippingAddress.address1");
  requireText(address.city, "shippingAddress.city");
  requireText(address.zip, "shippingAddress.zip");
  const country = normalizeCountry(address.countryCode);
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error("shippingAddress.countryCode must be a 2-letter country code");
  }
}

function assertEmail(value: string): void {
  const email = requireText(value, "customerEmail");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("customerEmail is invalid");
  }
}

function normalizeShopDomain(value: string): string {
  const raw = requireText(value, "Shopify shop domain")
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(raw)) {
    throw new Error("Shopify shop domain must be a *.myshopify.com hostname");
  }
  return raw.toLowerCase();
}

function escapeShopifySearch(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

function normalizeTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Shopify order timestamp is invalid");
  return new Date(parsed).toISOString();
}

function normalizeCountry(value: string): string {
  return value.trim().toUpperCase();
}

function requireText(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

function internalOrderIdFromIdempotencyKey(key: string): string {
  const prefix = "supplier-procurement:";
  if (!key.startsWith(prefix)) throw new Error("Supplier procurement idempotency key is invalid");
  const tail = key.slice(prefix.length);
  const index = tail.lastIndexOf(":");
  if (index <= 0) throw new Error("Supplier procurement idempotency key is invalid");
  return tail.slice(0, index);
}

function internalOrderItemIdFromIdempotencyKey(key: string): string {
  const prefix = "supplier-procurement:";
  if (!key.startsWith(prefix)) throw new Error("Supplier procurement idempotency key is invalid");
  const tail = key.slice(prefix.length);
  const index = tail.lastIndexOf(":");
  if (index <= 0 || index === tail.length - 1) {
    throw new Error("Supplier procurement idempotency key is invalid");
  }
  return tail.slice(index + 1);
}
