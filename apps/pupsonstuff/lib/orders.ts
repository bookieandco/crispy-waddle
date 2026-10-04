import { ValidatedCartItem } from '@/lib/catalog';

interface OrderInput {
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
  customerEmail?: string | null;
  currency?: string | null;
  amountTotalCents?: number | null;
  stripeCreatedAt?: string | null;
  paidAt?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: unknown;
}

interface OrderRow {
  id: string;
  stripe_session_id: string;
}


interface FinancialOrderRow {
  id: string;
  status: string;
  amount_total_cents: number | null;
  refunded_amount_cents: number;
}

export interface StripePaymentEconomicsInput {
  providerEventId: string;
  chargeId: string;
  balanceTransactionId?: string | null;
  feeCents?: number | null;
  netCents?: number | null;
  observedAt: string;
}

export interface StripeRefundEconomicsInput {
  providerEventId: string;
  paymentIntentId: string;
  chargeId: string;
  amountRefundedCents: number;
  currency: string;
  observedAt: string;
}

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

async function supabaseFetch(path: string, init: RequestInit = {}) {
  const config = getConfig();
  if (!config) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.');
  return fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
}

export async function upsertPaidOrder(input: OrderInput, items: ValidatedCartItem[]) {
  const response = await supabaseFetch('pupson_orders?on_conflict=stripe_session_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      stripe_session_id: input.stripeSessionId,
      stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
      status: 'paid',
      fulfillment_status: 'pending',
      customer_email: input.customerEmail ?? null,
      currency: input.currency ?? null,
      amount_total_cents: input.amountTotalCents ?? null,
      stripe_created_at: input.stripeCreatedAt ?? null,
      paid_at: input.paidAt ?? new Date().toISOString(),
      customer_name: input.customerName ?? null,
      customer_phone: input.customerPhone ?? null,
      shipping_address: input.shippingAddress ?? null,
    }),
  });
  if (!response.ok) throw new Error(`Supabase order upsert failed (${response.status}).`);

  const rows = (await response.json()) as OrderRow[];
  const order = rows[0] ?? (await getOrderByStripeSession(input.stripeSessionId));
  if (!order) throw new Error('Supabase order was not returned after upsert.');

  for (const item of items) {
    if (
      !item.printAssetId ||
      item.fulfillmentProvider !== 'printify' ||
      !item.providerVariantId ||
      !item.blueprintId ||
      !item.printProviderId ||
      !item.printArea ||
      !item.catalogCertificationStatus
    ) {
      throw new Error('Paid line item is missing its signed production snapshot.');
    }

    const outputResponse = await supabaseFetch(
      `pupson_creative_outputs?select=id&id=eq.${encodeURIComponent(item.creativeOutputId)}&limit=1`
    );
    if (!outputResponse.ok)
      throw new Error(`Creative output lookup failed (${outputResponse.status}).`);
    const output = ((await outputResponse.json()) as Array<{ id: string }>)[0];
    if (!output) throw new Error('Paid line item creative output no longer exists.');

    const printAssetResponse = await supabaseFetch(
      `pupson_media_assets?select=id,kind,provenance&id=eq.${encodeURIComponent(item.printAssetId)}&limit=1`
    );
    if (!printAssetResponse.ok)
      throw new Error(`Print asset lookup failed (${printAssetResponse.status}).`);
    const printAsset = (
      (await printAssetResponse.json()) as Array<{
        id: string;
        kind: string;
        provenance: Record<string, unknown> | null;
      }>
    )[0];
    const provenance = printAsset?.provenance;
    const printProfile =
      provenance?.printProfile && typeof provenance.printProfile === 'object'
        ? (provenance.printProfile as Record<string, unknown>)
        : null;
    if (
      !printAsset ||
      printAsset.kind !== 'print_ready' ||
      provenance?.creativeOutputId !== item.creativeOutputId ||
      printProfile?.productId !== item.productId ||
      printProfile?.variantId !== item.variantId
    ) {
      throw new Error('Paid line item print asset does not match its signed approval snapshot.');
    }

    const catalogSnapshot = {
      provider: item.fulfillmentProvider,
      provider_product_id: item.providerProductId ?? null,
      provider_variant_id: item.providerVariantId,
      blueprint_id: item.blueprintId,
      print_provider_id: item.printProviderId,
      print_area: item.printArea,
      certification_status: item.catalogCertificationStatus,
      product_id: item.productId,
      variant_id: item.variantId,
    };

    const itemResponse = await supabaseFetch('pupson_order_items?on_conflict=stripe_line_item_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({
        order_id: order.id,
        stripe_line_item_id: item.id,
        product_id: item.productId,
        variant_id: item.variantId,
        product_name: item.productName,
        variant_label: item.variantLabel,
        art_style: item.artStyle,
        quantity: item.quantity,
        unit_amount_cents: item.priceCents,
        fulfillment_provider: item.fulfillmentProvider,
        fulfillment_product_id: item.providerProductId ?? null,
        fulfillment_variant_id: item.providerVariantId,
        creative_output_id: output.id,
        print_asset_id: item.printAssetId,
        catalog_snapshot: catalogSnapshot,
        preview_path: null,
      }),
    });
    if (!itemResponse.ok)
      throw new Error(`Supabase order-item insert failed (${itemResponse.status}).`);
  }
  return order;
}

export async function getOrderByStripeSession(stripeSessionId: string): Promise<OrderRow | null> {
  const response = await supabaseFetch(
    `pupson_orders?select=id,stripe_session_id&stripe_session_id=eq.${encodeURIComponent(stripeSessionId)}&limit=1`
  );
  if (!response.ok) throw new Error(`Supabase order lookup failed (${response.status}).`);
  const rows = (await response.json()) as OrderRow[];
  return rows[0] ?? null;
}


export async function recordStripePaymentEconomics(
  orderId: string,
  input: StripePaymentEconomicsInput
): Promise<void> {
  requireNonNegativeIntegerOrNull(input.feeCents ?? null, 'Stripe fee');
  requireIntegerOrNull(input.netCents ?? null, 'Stripe net');
  const observedAt = requireDate(input.observedAt, 'Stripe payment observedAt');
  const response = await supabaseFetch(
    `pupson_orders?id=eq.${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        stripe_charge_id: requireText(input.chargeId, 'Stripe charge id'),
        stripe_balance_transaction_id:
          input.balanceTransactionId?.trim() || null,
        stripe_fee_cents: input.feeCents ?? null,
        stripe_net_cents: input.netCents ?? null,
        financial_observed_at: observedAt,
      }),
    }
  );
  if (!response.ok) throw new Error(`Stripe payment economics update failed (${response.status}).`);
  const rows = (await response.json()) as FinancialOrderRow[];
  if (!rows[0]) throw new Error('Stripe payment economics order was not found.');

  await recordFinancialEvent({
    orderId,
    providerEventId: input.providerEventId,
    eventType: 'payment_settled',
    occurredAt: observedAt,
    payload: {
      chargeId: input.chargeId,
      balanceTransactionId: input.balanceTransactionId ?? null,
      feeCents: input.feeCents ?? null,
      netCents: input.netCents ?? null,
    },
  });
}

export async function recordStripeRefundEconomicsByPaymentIntent(
  input: StripeRefundEconomicsInput
): Promise<{ orderId?: string; matched: boolean; fullyRefunded: boolean }> {
  requireNonNegativeIntegerOrNull(input.amountRefundedCents, 'Stripe refunded amount');
  const observedAt = requireDate(input.observedAt, 'Stripe refund observedAt');
  const lookup = await supabaseFetch(
    `pupson_orders?select=id,status,amount_total_cents,refunded_amount_cents&stripe_payment_intent_id=eq.${encodeURIComponent(requireText(input.paymentIntentId, 'Stripe payment intent id'))}&limit=1`
  );
  if (!lookup.ok) throw new Error(`Stripe refund order lookup failed (${lookup.status}).`);
  const order = ((await lookup.json()) as FinancialOrderRow[])[0];
  if (!order) return { matched: false, fullyRefunded: false };

  const fullyRefunded =
    order.amount_total_cents !== null &&
    input.amountRefundedCents >= order.amount_total_cents;
  const patch = await supabaseFetch(
    `pupson_orders?id=eq.${encodeURIComponent(order.id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        refunded_amount_cents: input.amountRefundedCents,
        financial_observed_at: observedAt,
        ...(fullyRefunded ? { status: 'refunded' } : {}),
      }),
    }
  );
  if (!patch.ok) throw new Error(`Stripe refund economics update failed (${patch.status}).`);

  await recordFinancialEvent({
    orderId: order.id,
    providerEventId: input.providerEventId,
    eventType: 'refund_observed',
    occurredAt: observedAt,
    payload: {
      paymentIntentId: input.paymentIntentId,
      chargeId: requireText(input.chargeId, 'Stripe charge id'),
      amountRefundedCents: input.amountRefundedCents,
      currency: requireText(input.currency, 'Stripe refund currency').toLowerCase(),
      fullyRefunded,
    },
  });

  return { orderId: order.id, matched: true, fullyRefunded };
}

async function recordFinancialEvent(input: {
  orderId: string;
  providerEventId: string;
  eventType: 'payment_settled' | 'refund_observed';
  occurredAt: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const response = await supabaseFetch(
    'pupson_order_financial_events?on_conflict=provider,provider_event_id',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({
        order_id: requireText(input.orderId, 'Order id'),
        provider: 'stripe',
        provider_event_id: requireText(input.providerEventId, 'Provider event id'),
        event_type: input.eventType,
        payload: input.payload,
        occurred_at: requireDate(input.occurredAt, 'Financial event occurredAt'),
      }),
    }
  );
  if (!response.ok) throw new Error(`Financial event insert failed (${response.status}).`);
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

function requireDate(value: string, field: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be a valid date.`);
  return new Date(parsed).toISOString();
}

function requireIntegerOrNull(value: number | null, field: string): void {
  if (value !== null && !Number.isInteger(value)) {
    throw new Error(`${field} must be an integer when present.`);
  }
}

function requireNonNegativeIntegerOrNull(value: number | null, field: string): void {
  requireIntegerOrNull(value, field);
  if (value !== null && value < 0) {
    throw new Error(`${field} must be non-negative.`);
  }
}
