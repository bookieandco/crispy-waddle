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
    if (
      !item.printAssetId ||
      item.fulfillmentProvider !== 'printify' ||
      !item.providerProductId ||
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
      provider_product_id: item.providerProductId,
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
        fulfillment_product_id: item.providerProductId,
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
