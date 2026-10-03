import { createSignedAssetUrl, rest } from '@/lib/platform';
import {
  findOrderByExternalId,
  getOrder,
  resolvePrintifyShopId,
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
  product_id: string;
  variant_id: string;
  quantity: number;
  fulfillment_provider: 'printful' | 'printify';
  fulfillment_product_id: string | null;
  fulfillment_variant_id: string;
  catalog_snapshot: Record<string, unknown>;
  print_asset: { bucket_id: string; object_path: string } | null;
}

type FulfillmentStatus =
  | 'pending'
  | 'submitting'
  | 'submission_unknown'
  | 'submitted'
  | 'in_production'
  | 'shipped'
  | 'fulfilled'
  | 'blocked'
  | 'failed'
  | 'cancelled';

interface FulfillmentRow {
  id: string;
  order_id: string;
  status: FulfillmentStatus;
  attempt_count: number;
  provider: string;
  provider_order_id?: string | null;
}

function normalizePrintifyStatus(provider: {
  status: string;
  shipments?: Array<unknown>;
  sent_to_production_at?: string | null;
}): 'submitted' | 'in_production' | 'shipped' | 'fulfilled' | 'cancelled' | 'failed' {
  if (provider.status === 'fulfilled') return 'fulfilled';
  if (provider.status === 'canceled' || provider.status === 'cancelled') return 'cancelled';
  if (
    ['payment-not-received', 'has-issues', 'unfulfillable', 'source-check-failed'].includes(
      provider.status
    )
  ) {
    return 'failed';
  }
  if (provider.shipments?.length) return 'shipped';
  if (provider.sent_to_production_at) return 'in_production';
  return 'submitted';
}

function orderFulfillmentStatus(
  status: ReturnType<typeof normalizePrintifyStatus>
): 'submitted' | 'fulfilled' | 'blocked' | 'cancelled' {
  if (status === 'fulfilled') return 'fulfilled';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'failed') return 'blocked';
  return 'submitted';
}

function isAmbiguousSubmissionError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) return true;
  const status = Number((error as { status?: unknown }).status);
  if (!Number.isFinite(status)) return true;
  if (status === 0) return false;
  if (status >= 500) return true;
  return [408, 409, 425, 429].includes(status);
}

async function writeFulfillmentEvent(
  fulfillmentId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  await rest('pupson_fulfillment_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      fulfillment_order_id: fulfillmentId,
      event_type: eventType,
      payload,
    }),
  });
}

async function recoverUnknownSubmission(
  shopId: string,
  fulfillment: FulfillmentRow
): Promise<{ status: string; providerOrderId?: string }> {
  const lookup = await findOrderByExternalId(shopId, fulfillment.id);
  if (!lookup.order) {
    const message = lookup.exhaustive
      ? 'Printify submission outcome remains unknown; no matching external order is visible yet. Resubmission is blocked.'
      : 'Printify submission outcome remains unknown; provider scan was incomplete. Resubmission is blocked.';
    await rest(`pupson_fulfillment_orders?id=eq.${fulfillment.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'submission_unknown', last_error: message }),
    });
    await writeFulfillmentEvent(fulfillment.id, 'submission_recovery_pending', {
      pagesScanned: lookup.pagesScanned,
      exhaustive: lookup.exhaustive,
    });
    return { status: 'submission_unknown' };
  }

  const provider = lookup.order;
  const normalized = normalizePrintifyStatus(provider);
  await rest(`pupson_fulfillment_orders?id=eq.${fulfillment.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: normalized,
      provider_order_id: provider.id,
      submitted_at: provider.created_at || new Date().toISOString(),
      tracking: provider.shipments ?? [],
      fulfilled_at: provider.fulfilled_at,
      last_error: null,
    }),
  });
  await rest(`pupson_orders?id=eq.${fulfillment.order_id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      fulfillment_status: orderFulfillmentStatus(normalized),
    }),
  });
  await writeFulfillmentEvent(fulfillment.id, 'submission_recovered', {
    providerOrderId: provider.id,
    providerStatus: provider.status,
    normalized,
    pagesScanned: lookup.pagesScanned,
    exhaustive: lookup.exhaustive,
  });
  return { status: normalized, providerOrderId: provider.id };
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
  const fulfillmentRows = await rest<FulfillmentRow[]>(
    `pupson_fulfillment_orders?select=*&id=eq.${fulfillmentId}&limit=1`
  );
  const fulfillment = fulfillmentRows[0];
  if (!fulfillment) throw new Error('Fulfillment order not found.');
  if (['submitted', 'in_production', 'shipped', 'fulfilled', 'cancelled'].includes(fulfillment.status))
    return { status: fulfillment.status, providerOrderId: fulfillment.provider_order_id ?? undefined };

  if (['submitting', 'submission_unknown'].includes(fulfillment.status)) {
    const shopId = await resolvePrintifyShopId();
    return recoverUnknownSubmission(shopId, fulfillment);
  }

  const orders = await rest<OrderRow[]>(
    `pupson_orders?select=id,customer_email,customer_name,customer_phone,shipping_address&id=eq.${fulfillment.order_id}&limit=1`
  );
  const order = orders[0];
  if (!order) throw new Error('Commerce order not found.');
  const items = await rest<OrderItemRow[]>(
    `pupson_order_items?select=id,product_id,variant_id,quantity,fulfillment_provider,fulfillment_product_id,fulfillment_variant_id,catalog_snapshot,print_asset:pupson_media_assets!print_asset_id(bucket_id,object_path)&order_id=eq.${order.id}`
  );
  if (items.length === 0) throw new Error('Order has no fulfillment items.');
  if (items.some((item) => item.fulfillment_provider !== 'printify'))
    throw new Error('Launch fulfillment supports one Printify order at a time.');
  const mode = process.env.PUPSON_FULFILLMENT_MODE ?? 'dry_run';

  for (const item of items) {
    const currentRows = await rest<
      Array<{
        provider: string;
        provider_product_id: string | null;
        provider_variant_id: string;
        blueprint_id: string | null;
        print_provider_id: string | null;
        print_area: string;
        active: boolean;
        certification_status: string;
      }>
    >(
      `pupson_catalog_variants?select=provider,provider_product_id,provider_variant_id,blueprint_id,print_provider_id,print_area,active,certification_status&product_id=eq.${encodeURIComponent(item.product_id)}&variant_id=eq.${encodeURIComponent(item.variant_id)}&limit=1`
    );
    const current = currentRows[0];
    const snapshot = item.catalog_snapshot;
    const certificationSafe =
      mode === 'live'
        ? current?.certification_status === 'sample_verified'
        : ['sandbox_verified', 'sample_verified'].includes(String(current?.certification_status));
    const mappingSafe =
      current?.active === true &&
      current.provider === 'printify' &&
      certificationSafe &&
      (current.provider_product_id ?? null) ===
        (typeof snapshot.provider_product_id === 'string'
          ? snapshot.provider_product_id
          : null) &&
      current.provider_variant_id === String(snapshot.provider_variant_id ?? '') &&
      String(current.blueprint_id ?? '') === String(snapshot.blueprint_id ?? '') &&
      String(current.print_provider_id ?? '') === String(snapshot.print_provider_id ?? '') &&
      current.print_area === String(snapshot.print_area ?? '');
    if (!mappingSafe) {
      const message =
        mode === 'live'
          ? 'Current catalog mapping is suspended, changed, or has not passed physical-sample certification.'
          : 'Current catalog mapping is suspended, changed, or no longer sandbox certified.';
      await rest(`pupson_fulfillment_orders?id=eq.${fulfillment.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'blocked', last_error: message }),
      });
      await rest('pupson_fulfillment_events', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          fulfillment_order_id: fulfillment.id,
          event_type: 'catalog_gate_blocked',
          payload: { productId: item.product_id, variantId: item.variant_id, mode },
        }),
      });
      return { status: 'blocked' };
    }
  }
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
  const shopId = await resolvePrintifyShopId();

  let lineItems: PrintifyLineItem[];
  try {
    lineItems = [];
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fulfillment preparation failed.';
    await rest(`pupson_fulfillment_orders?id=eq.${fulfillment.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'failed', last_error: message }),
    });
    await writeFulfillmentEvent(fulfillment.id, 'submission_preparation_failed', { message });
    throw error;
  }

  const claimedRows = await rest<FulfillmentRow[]>(
    `pupson_fulfillment_orders?id=eq.${fulfillment.id}&status=in.(pending,failed,blocked)`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'submitting',
        attempt_count: fulfillment.attempt_count + 1,
        last_error: null,
      }),
    }
  );
  if (!claimedRows[0]) {
    const currentRows = await rest<FulfillmentRow[]>(
      `pupson_fulfillment_orders?select=*&id=eq.${fulfillment.id}&limit=1`
    );
    const current = currentRows[0];
    if (!current) throw new Error('Fulfillment order disappeared during submission claim.');
    if (['submitting', 'submission_unknown'].includes(current.status)) {
      return recoverUnknownSubmission(shopId, current);
    }
    return {
      status: current.status,
      providerOrderId: current.provider_order_id ?? undefined,
    };
  }

  try {
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
        last_error: null,
      }),
    });
    await rest(`pupson_orders?id=eq.${order.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ fulfillment_status: 'submitted' }),
    });
    await writeFulfillmentEvent(fulfillment.id, 'submitted', {
      providerOrderId: created.id,
    });
    return { status: 'submitted', providerOrderId: created.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fulfillment submission failed.';
    if (isAmbiguousSubmissionError(error)) {
      await rest(`pupson_fulfillment_orders?id=eq.${fulfillment.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'submission_unknown', last_error: message }),
      });
      await writeFulfillmentEvent(fulfillment.id, 'submission_unknown', { message });

      try {
        return await recoverUnknownSubmission(shopId, {
          ...fulfillment,
          status: 'submission_unknown',
          attempt_count: fulfillment.attempt_count + 1,
        });
      } catch (recoveryError) {
        await writeFulfillmentEvent(fulfillment.id, 'submission_recovery_failed', {
          message:
            recoveryError instanceof Error
              ? recoveryError.message
              : 'Printify submission recovery failed.',
        });
        return { status: 'submission_unknown' };
      }
    }

    await rest(`pupson_fulfillment_orders?id=eq.${fulfillment.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'failed', last_error: message }),
    });
    await writeFulfillmentEvent(fulfillment.id, 'submission_failed', { message });
    throw error;
  }
}

export async function reconcileFulfillment(
  limit = 50
): Promise<{ checked: number; updated: number }> {
  const shopId = await resolvePrintifyShopId();

  const unknownRows = await rest<FulfillmentRow[]>(
    `pupson_fulfillment_orders?select=id,order_id,status,attempt_count,provider,provider_order_id&provider=eq.printify&provider_order_id=is.null&status=in.(submitting,submission_unknown)&limit=${limit}`
  );

  let checked = 0;
  let updated = 0;
  for (const row of unknownRows) {
    checked += 1;
    const recovered = await recoverUnknownSubmission(shopId, row);
    if (recovered.status !== 'submission_unknown') updated += 1;
  }

  const rows = await rest<
    Array<{ id: string; order_id: string; provider_order_id: string; status: string }>
  >(
    `pupson_fulfillment_orders?select=id,order_id,provider_order_id,status&provider=eq.printify&provider_order_id=not.is.null&status=in.(submitted,in_production,shipped)&limit=${limit}`
  );
  for (const row of rows) {
    checked += 1;
    const provider = await getOrder(shopId, row.provider_order_id);
    const normalized = normalizePrintifyStatus(provider);
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
        fulfillment_status: orderFulfillmentStatus(normalized),
      }),
    });
    await writeFulfillmentEvent(row.id, 'reconciled', {
      providerStatus: provider.status,
      normalized,
      shipments: provider.shipments,
    });
  }
  return { checked, updated };
}
