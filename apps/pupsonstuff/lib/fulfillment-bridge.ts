import { createSignedAssetUrl, rest } from '@/lib/platform';
import {
  getOrder,
  submitOrder,
  uploadImage,
  PrintifyAddressTo,
  PrintifyLineItem,
} from '@/lib/printify';

interface OrderRow {
  id: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_address: Record<string, string | null> | null;
}

interface OrderItemRow {
  id: string;
  quantity: number;
  fulfillment_provider: 'printful' | 'printify';
  fulfillment_product_id: string;
  fulfillment_variant_id: string;
  catalog_snapshot: Record<string, unknown>;
  print_asset: { bucket_id: string; object_path: string } | null;
}

export async function queueFulfillment(orderId: string): Promise<string> {
  const rows = await rest<Array<{ id: string }>>('pupson_fulfillment_orders?on_conflict=order_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({
      order_id: orderId,
      provider: 'printify',
      idempotency_key: `pupson-order:${orderId}`,
      status: 'pending',
    }),
  });
  if (rows[0]) return rows[0].id;
  const existing = await rest<Array<{ id: string }>>(
    `pupson_fulfillment_orders?select=id&order_id=eq.${orderId}&limit=1`
  );
  if (!existing[0]) throw new Error('Fulfillment order could not be queued.');
  return existing[0].id;
}

function addressFor(order: OrderRow): PrintifyAddressTo {
  const address = order.shipping_address;
  if (!address || !order.customer_email)
    throw new Error('Order is missing a shipping address or email.');
  const names = (order.customer_name ?? 'PupsonStuff Customer').trim().split(/\s+/);
  return {
    first_name: names.shift() ?? 'Customer',
    last_name: names.join(' ') || 'Customer',
    address1: address.line1 ?? '',
    address2: address.line2 ?? undefined,
    city: address.city ?? '',
    region: address.state,
    zip: address.postal_code ?? '',
    country: address.country ?? 'US',
    email: order.customer_email,
    phone: order.customer_phone ?? '',
  };
}

export async function submitFulfillment(
  fulfillmentId: string
): Promise<{ status: string; providerOrderId?: string }> {
  const fulfillmentRows = await rest<
    Array<{ id: string; order_id: string; status: string; attempt_count: number; provider: string }>
  >(`pupson_fulfillment_orders?select=*&id=eq.${fulfillmentId}&limit=1`);
  const fulfillment = fulfillmentRows[0];
  if (!fulfillment) throw new Error('Fulfillment order not found.');
  if (['submitted', 'in_production', 'shipped', 'fulfilled'].includes(fulfillment.status))
    return { status: fulfillment.status };
  const orders = await rest<OrderRow[]>(
    `pupson_orders?select=id,customer_email,customer_name,customer_phone,shipping_address&id=eq.${fulfillment.order_id}&limit=1`
  );
  const order = orders[0];
  if (!order) throw new Error('Commerce order not found.');
  const items = await rest<OrderItemRow[]>(
    `pupson_order_items?select=id,quantity,fulfillment_provider,fulfillment_product_id,fulfillment_variant_id,catalog_snapshot,print_asset:pupson_media_assets!print_asset_id(bucket_id,object_path)&order_id=eq.${order.id}`
  );
  if (items.length === 0) throw new Error('Order has no fulfillment items.');
  if (items.some((item) => item.fulfillment_provider !== 'printify'))
    throw new Error('Launch fulfillment supports one Printify order at a time.');
  const mode = process.env.PUPSON_FULFILLMENT_MODE ?? 'dry_run';
  if (mode !== 'live') {
    await rest(`pupson_fulfillment_orders?id=eq.${fulfillment.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'blocked',
        last_error: 'Dry-run mode: request validated but not sent to Printify.',
      }),
    });
    await rest('pupson_fulfillment_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        fulfillment_order_id: fulfillment.id,
        event_type: 'dry_run_validated',
        payload: { itemCount: items.length },
      }),
    });
    return { status: 'blocked' };
  }
  const shopId = process.env.PRINTIFY_SHOP_ID;
  if (!shopId) throw new Error('PRINTIFY_SHOP_ID is not configured.');
  await rest(`pupson_fulfillment_orders?id=eq.${fulfillment.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'submitting',
      attempt_count: fulfillment.attempt_count + 1,
      last_error: null,
    }),
  });
  try {
    const lineItems: PrintifyLineItem[] = [];
    for (const item of items) {
      if (!item.print_asset) throw new Error('Fulfillment item is missing its print asset.');
      const assetUrl = await createSignedAssetUrl(
        item.print_asset.bucket_id,
        item.print_asset.object_path,
        300
      );
      const assetResponse = await fetch(assetUrl);
      if (!assetResponse.ok) throw new Error('Could not download print asset.');
      const upload = await uploadImage({
        file_name: `${item.id}.png`,
        contents: Buffer.from(await assetResponse.arrayBuffer()).toString('base64'),
      });
      const blueprintId = Number(item.catalog_snapshot.blueprint_id);
      const printProviderId = Number(item.catalog_snapshot.print_provider_id);
      const variantId = Number(item.fulfillment_variant_id);
      if (![blueprintId, printProviderId, variantId].every(Number.isInteger))
        throw new Error('Printify catalog mapping is incomplete.');
      lineItems.push({
        blueprint_id: blueprintId,
        print_provider_id: printProviderId,
        variant_id: variantId,
        quantity: item.quantity,
        external_id: item.id,
        print_areas: { [String(item.catalog_snapshot.print_area ?? 'front')]: upload.id },
      });
    }
    const created = await submitOrder(shopId, {
      external_id: fulfillment.id,
      label: `PupsonStuff ${order.id}`,
      line_items: lineItems,
      send_shipping_notification: true,
      address_to: addressFor(order),
    });
    await rest(`pupson_fulfillment_orders?id=eq.${fulfillment.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'submitted',
        provider_order_id: created.id,
        submitted_at: new Date().toISOString(),
      }),
    });
    await rest(`pupson_orders?id=eq.${order.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ fulfillment_status: 'submitted' }),
    });
    await rest('pupson_fulfillment_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        fulfillment_order_id: fulfillment.id,
        event_type: 'submitted',
        payload: { providerOrderId: created.id },
      }),
    });
    return { status: 'submitted', providerOrderId: created.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fulfillment submission failed.';
    await rest(`pupson_fulfillment_orders?id=eq.${fulfillment.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'failed', last_error: message }),
    });
    throw error;
  }
}

export async function reconcileFulfillment(
  limit = 50
): Promise<{ checked: number; updated: number }> {
  const shopId = process.env.PRINTIFY_SHOP_ID;
  if (!shopId) throw new Error('PRINTIFY_SHOP_ID is not configured.');
  const rows = await rest<
    Array<{ id: string; order_id: string; provider_order_id: string; status: string }>
  >(
    `pupson_fulfillment_orders?select=id,order_id,provider_order_id,status&provider=eq.printify&provider_order_id=not.is.null&status=in.(submitted,in_production,shipped)&limit=${limit}`
  );
  let updated = 0;
  for (const row of rows) {
    const provider = await getOrder(shopId, row.provider_order_id);
    const normalized =
      provider.status === 'fulfilled'
        ? 'fulfilled'
        : provider.shipments?.length
          ? 'shipped'
          : provider.sent_to_production_at
            ? 'in_production'
            : 'submitted';
    if (normalized !== row.status) updated += 1;
    await rest(`pupson_fulfillment_orders?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: normalized,
        tracking: provider.shipments ?? [],
        fulfilled_at: provider.fulfilled_at,
      }),
    });
    await rest(`pupson_orders?id=eq.${row.order_id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        fulfillment_status: normalized === 'fulfilled' ? 'fulfilled' : 'submitted',
      }),
    });
    await rest('pupson_fulfillment_events', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        fulfillment_order_id: row.id,
        event_type: 'reconciled',
        payload: { providerStatus: provider.status, normalized, shipments: provider.shipments },
      }),
    });
  }
  return { checked: rows.length, updated };
}
