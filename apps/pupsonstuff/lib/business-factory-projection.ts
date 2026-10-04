import { hotspots } from '@/data/hotspots';
import { rest } from '@/lib/platform';

type CatalogRow = {
  product_id: string;
  variant_id: string;
  provider: string;
  provider_product_id: string | null;
  provider_variant_id: string;
  blueprint_id: string | null;
  print_provider_id: string | null;
  print_area: string;
  retail_price_cents: number;
  base_cost_cents: number | null;
  currency: string;
  active: boolean;
  certification_status: string;
  certified_at: string | null;
  updated_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  unit_amount_cents: number;
};

type OrderRow = {
  id: string;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  status: string;
  fulfillment_status: string;
  currency: string | null;
  amount_total_cents: number | null;
  stripe_charge_id: string | null;
  stripe_balance_transaction_id: string | null;
  stripe_fee_cents: number | null;
  stripe_net_cents: number | null;
  refunded_amount_cents: number;
  financial_observed_at: string | null;
  paid_at: string | null;
};

type FulfillmentRow = {
  id: string;
  order_id: string;
  provider: string;
  provider_order_id: string | null;
  status: string;
  provider_product_cost_cents: number | null;
  provider_shipping_cost_cents: number | null;
  provider_tax_cents: number | null;
  provider_total_cost_cents: number | null;
  provider_cost_observed_at: string | null;
  fulfilled_at: string | null;
};

export type PupsonBusinessFactoryProductProjection = {
  productId: string;
  variantId: string;
  title: string;
  variantLabel: string;
  productType: string;
  retailPriceCents: number;
  baseCostCents: number | null;
  currency: string;
  active: boolean;
  certificationStatus: string;
  certifiedAt?: string;
  provider: string;
  providerProductId?: string;
  providerVariantId: string;
  blueprintId?: string;
  printProviderId?: string;
  printArea: string;
  productionLeadDays?: number;
  storefrontPresent: boolean;
  liveSellable: boolean;
  observedAt: string;
  evidenceRefs: string[];
};

export type PupsonBusinessFactorySettlementProjection = {
  orderId: string;
  productId: string;
  variantId: string;
  state: 'pending' | 'settled';
  blockerCodes: string[];
  currency: string;
  grossRevenueCents: number;
  refundedAmountCents: number;
  stripeFeeCents: number | null;
  productCostCents: number | null;
  shippingCostCents: number | null;
  providerTaxCents: number | null;
  costBasisComplete: boolean;
  paidAt?: string;
  financialObservedAt?: string;
  providerCostObservedAt?: string;
  transactionRefs: string[];
  evidenceRefs: string[];
  observedAt: string;
};

export type PupsonBusinessFactoryProjection = {
  sourceOwner: 'pupsonstuff';
  product: PupsonBusinessFactoryProductProjection;
  settlements: PupsonBusinessFactorySettlementProjection[];
  settlementHoldDays: number;
  authority: 'READ_ONLY_SOURCE_PROJECTION';
  externalActionAuthorized: false;
  publishingAuthorized: false;
  refundAuthorized: false;
  moneyMovementAuthorized: false;
};

export async function buildPupsonBusinessFactoryProjection(input: {
  productId: string;
  variantId: string;
  now?: string;
  settlementHoldDays?: number;
  settlementLimit?: number;
}): Promise<PupsonBusinessFactoryProjection> {
  const productId = requireText(input.productId, 'productId');
  const variantId = requireText(input.variantId, 'variantId');
  const now = normalizeDate(input.now ?? new Date().toISOString(), 'now');
  const settlementHoldDays = boundedInteger(
    input.settlementHoldDays ?? Number(process.env.PUPSON_SETTLEMENT_HOLD_DAYS ?? 30),
    0,
    180,
    'settlementHoldDays'
  );
  const settlementLimit = boundedInteger(input.settlementLimit ?? 50, 1, 200, 'settlementLimit');

  const catalogRows = await rest<CatalogRow[]>(
    `pupson_catalog_variants?select=product_id,variant_id,provider,provider_product_id,provider_variant_id,blueprint_id,print_provider_id,print_area,retail_price_cents,base_cost_cents,currency,active,certification_status,certified_at,updated_at&product_id=eq.${encodeURIComponent(productId)}&variant_id=eq.${encodeURIComponent(variantId)}&limit=1`
  );
  const catalog = catalogRows[0];
  if (!catalog) throw new Error('PUPSON_BUSINESS_FACTORY_CATALOG_VARIANT_NOT_FOUND');

  const storefrontMatches = hotspots.filter((hotspot) =>
    hotspot.fulfillment?.productId === productId &&
    hotspot.fulfillment.variants.some((variant) => variant.variantId === variantId)
  );
  const variantLabels = unique(
    storefrontMatches.flatMap((hotspot) =>
      hotspot.fulfillment?.variants
        .filter((variant) => variant.variantId === variantId)
        .map((variant) => variant.label) ?? []
    )
  );
  const productTypes = unique(storefrontMatches.map((hotspot) => hotspot.product));
  const deliveryMaxes = storefrontMatches
    .map((hotspot) => hotspot.estimatedDeliveryDays?.[1])
    .filter((value): value is number => Number.isInteger(value) && value >= 0);

  const liveSellable =
    process.env.PUPSON_FULFILLMENT_MODE === 'live' &&
    catalog.active === true &&
    catalog.certification_status === 'sample_verified' &&
    storefrontMatches.length > 0;

  const itemRows = await rest<OrderItemRow[]>(
    `pupson_order_items?select=id,order_id,product_id,variant_id,quantity,unit_amount_cents&product_id=eq.${encodeURIComponent(productId)}&variant_id=eq.${encodeURIComponent(variantId)}&order=created_at.desc&limit=${settlementLimit}`
  );
  const orderIds = unique(itemRows.map((item) => item.order_id));
  const settlements = orderIds.length
    ? await buildSettlements({
        orderIds,
        productId,
        variantId,
        now,
        settlementHoldDays,
      })
    : [];

  return Object.freeze({
    sourceOwner: 'pupsonstuff',
    product: Object.freeze({
      productId,
      variantId,
      title: storefrontMatches[0]?.name ?? productId,
      variantLabel: variantLabels[0] ?? variantId,
      productType: productTypes[0] ?? productId,
      retailPriceCents: catalog.retail_price_cents,
      baseCostCents: catalog.base_cost_cents,
      currency: catalog.currency.toUpperCase(),
      active: catalog.active,
      certificationStatus: catalog.certification_status,
      certifiedAt: catalog.certified_at ?? undefined,
      provider: catalog.provider,
      providerProductId: catalog.provider_product_id ?? undefined,
      providerVariantId: catalog.provider_variant_id,
      blueprintId: catalog.blueprint_id ?? undefined,
      printProviderId: catalog.print_provider_id ?? undefined,
      printArea: catalog.print_area,
      productionLeadDays: deliveryMaxes.length ? Math.max(...deliveryMaxes) : undefined,
      storefrontPresent: storefrontMatches.length > 0,
      liveSellable,
      observedAt: normalizeDate(catalog.updated_at, 'catalog.updated_at'),
      evidenceRefs: unique([
        `pupson-catalog:${productId}:${variantId}`,
        ...(catalog.certified_at ? [`pupson-catalog-certified:${catalog.certified_at}`] : []),
        ...(storefrontMatches.length ? [`pupson-storefront:${productId}:${variantId}`] : []),
      ]),
    }),
    settlements: Object.freeze(settlements),
    settlementHoldDays,
    authority: 'READ_ONLY_SOURCE_PROJECTION',
    externalActionAuthorized: false,
    publishingAuthorized: false,
    refundAuthorized: false,
    moneyMovementAuthorized: false,
  });
}

async function buildSettlements(input: {
  orderIds: string[];
  productId: string;
  variantId: string;
  now: string;
  settlementHoldDays: number;
}): Promise<PupsonBusinessFactorySettlementProjection[]> {
  const ids = input.orderIds.map(encodeURIComponent).join(',');
  const [orders, allItems, fulfillments] = await Promise.all([
    rest<OrderRow[]>(
      `pupson_orders?select=id,stripe_session_id,stripe_payment_intent_id,status,fulfillment_status,currency,amount_total_cents,stripe_charge_id,stripe_balance_transaction_id,stripe_fee_cents,stripe_net_cents,refunded_amount_cents,financial_observed_at,paid_at&id=in.(${ids})`
    ),
    rest<OrderItemRow[]>(
      `pupson_order_items?select=id,order_id,product_id,variant_id,quantity,unit_amount_cents&order_id=in.(${ids})`
    ),
    rest<FulfillmentRow[]>(
      `pupson_fulfillment_orders?select=id,order_id,provider,provider_order_id,status,provider_product_cost_cents,provider_shipping_cost_cents,provider_tax_cents,provider_total_cost_cents,provider_cost_observed_at,fulfilled_at&order_id=in.(${ids})`
    ),
  ]);

  const itemByOrder = groupBy(allItems, (item) => item.order_id);
  const fulfillmentByOrder = new Map(fulfillments.map((item) => [item.order_id, item]));
  const nowMs = Date.parse(input.now);
  const holdMs = input.settlementHoldDays * 86_400_000;

  return orders.map((order) => {
    const items = itemByOrder.get(order.id) ?? [];
    const distinctSkus = new Set(items.map((item) => `${item.product_id}\u0000${item.variant_id}`));
    const singleSku =
      distinctSkus.size === 1 &&
      items.every((item) =>
        item.product_id === input.productId && item.variant_id === input.variantId
      );
    const fulfillment = fulfillmentByOrder.get(order.id);
    const blockers: string[] = [];

    if (!singleSku) blockers.push('MULTI_SKU_OR_BINDING_MISMATCH');
    if (!order.paid_at || order.amount_total_cents === null || !order.currency) {
      blockers.push('PAYMENT_TRUTH_INCOMPLETE');
    }
    if (
      order.stripe_fee_cents === null ||
      !order.financial_observed_at ||
      !order.stripe_balance_transaction_id
    ) {
      blockers.push('STRIPE_SETTLEMENT_INCOMPLETE');
    }
    if (
      !fulfillment ||
      fulfillment.provider_product_cost_cents === null ||
      fulfillment.provider_shipping_cost_cents === null ||
      fulfillment.provider_tax_cents === null ||
      fulfillment.provider_total_cost_cents === null ||
      !fulfillment.provider_cost_observed_at
    ) {
      blockers.push('PROVIDER_COST_TRUTH_INCOMPLETE');
    }
    if (fulfillment?.status !== 'fulfilled' || !fulfillment.fulfilled_at) {
      blockers.push('FULFILLMENT_NOT_FINAL');
    }
    if (order.paid_at && nowMs - Date.parse(order.paid_at) < holdMs) {
      blockers.push('REFUND_HOLD_WINDOW_OPEN');
    }

    const transactionRefs = unique([
      `stripe-session:${order.stripe_session_id}`,
      ...(order.stripe_payment_intent_id ? [`stripe-payment-intent:${order.stripe_payment_intent_id}`] : []),
      ...(order.stripe_charge_id ? [`stripe-charge:${order.stripe_charge_id}`] : []),
      ...(order.stripe_balance_transaction_id ? [`stripe-balance-transaction:${order.stripe_balance_transaction_id}`] : []),
    ]);
    const evidenceRefs = unique([
      `pupson-order:${order.id}`,
      ...transactionRefs,
      ...(fulfillment ? [`pupson-fulfillment:${fulfillment.id}`] : []),
      ...(fulfillment?.provider_order_id ? [`printify-order:${fulfillment.provider_order_id}`] : []),
      `pupson-sku:${input.productId}:${input.variantId}`,
    ]);
    const observedTimes = [
      order.financial_observed_at,
      fulfillment?.provider_cost_observed_at,
      fulfillment?.fulfilled_at,
      order.paid_at,
    ].filter((value): value is string => Boolean(value));
    const observedAt = observedTimes.length
      ? observedTimes.sort((a, b) => Date.parse(b) - Date.parse(a))[0]!
      : input.now;

    return Object.freeze({
      orderId: order.id,
      productId: input.productId,
      variantId: input.variantId,
      state: blockers.length === 0 ? 'settled' as const : 'pending' as const,
      blockerCodes: Object.freeze(blockers),
      currency: (order.currency ?? 'USD').toUpperCase(),
      grossRevenueCents: order.amount_total_cents ?? 0,
      refundedAmountCents: order.refunded_amount_cents ?? 0,
      stripeFeeCents: order.stripe_fee_cents,
      productCostCents: fulfillment?.provider_product_cost_cents ?? null,
      shippingCostCents: fulfillment?.provider_shipping_cost_cents ?? null,
      providerTaxCents: fulfillment?.provider_tax_cents ?? null,
      costBasisComplete:
        blockers.includes('PROVIDER_COST_TRUTH_INCOMPLETE') === false &&
        blockers.includes('STRIPE_SETTLEMENT_INCOMPLETE') === false,
      paidAt: order.paid_at ?? undefined,
      financialObservedAt: order.financial_observed_at ?? undefined,
      providerCostObservedAt: fulfillment?.provider_cost_observed_at ?? undefined,
      transactionRefs: Object.freeze(transactionRefs),
      evidenceRefs: Object.freeze(evidenceRefs),
      observedAt,
    });
  }).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
}

function groupBy<T, K>(values: readonly T[], key: (value: T) => K): Map<K, T[]> {
  const output = new Map<K, T[]>();
  for (const value of values) {
    const id = key(value);
    const bucket = output.get(id) ?? [];
    bucket.push(value);
    output.set(id, bucket);
  }
  return output;
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

function normalizeDate(value: string, field: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be a valid date.`);
  return new Date(parsed).toISOString();
}

function boundedInteger(value: number, min: number, max: number, field: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${field} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
