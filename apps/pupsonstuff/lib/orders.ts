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
    const outputResponse = await supabaseFetch(
      `pupson_creative_outputs?select=id,print_asset_id,approval_status&id=eq.${encodeURIComponent(item.creativeOutputId)}&limit=1`
    );
    if (!outputResponse.ok)
      throw new Error(`Creative output lookup failed (${outputResponse.status}).`);
    const output = (
      (await outputResponse.json()) as Array<{
        id: string;
        print_asset_id: string | null;
        approval_status: string;
      }>
    )[0];
    if (!output?.print_asset_id || output.approval_status !== 'approved')
      throw new Error('Paid line item does not have an approved print asset.');
    const catalogResponse = await supabaseFetch(
      `pupson_catalog_variants?select=*&product_id=eq.${encodeURIComponent(item.productId)}&variant_id=eq.${encodeURIComponent(item.variantId)}&active=eq.true&limit=1`
    );
    if (!catalogResponse.ok)
      throw new Error(`Catalog mapping lookup failed (${catalogResponse.status}).`);
    const catalog = ((await catalogResponse.json()) as Array<Record<string, unknown>>)[0];
    if (
      !catalog ||
      !['sandbox_verified', 'sample_verified'].includes(String(catalog.certification_status))
    )
      throw new Error('Paid line item catalog mapping is not certified.');
    const itemResponse = await supabaseFetch('pupson_order_items?on_conflict=stripe_line_item_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({
        order_id: order.id,
        // item.id is the actual Stripe line-item ID from the signed webhook.
        stripe_line_item_id: item.id,
        product_id: item.productId,
        variant_id: item.variantId,
        product_name: item.productName,
        variant_label: item.variantLabel,
        art_style: item.artStyle,
        quantity: item.quantity,
        unit_amount_cents: item.priceCents,
        fulfillment_provider: catalog.provider,
        fulfillment_product_id: catalog.provider_product_id,
        fulfillment_variant_id: catalog.provider_variant_id,
        creative_output_id: output.id,
        print_asset_id: output.print_asset_id,
        catalog_snapshot: catalog,
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
