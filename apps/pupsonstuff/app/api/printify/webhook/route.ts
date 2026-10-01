import { NextRequest, NextResponse } from 'next/server';
import { rest } from '@/lib/platform';
import {
  printifyFulfillmentStatus,
  printifyProviderOrderId,
  printifyTrackingPayload,
  type PrintifyWebhookEvent,
  verifyPrintifyWebhookSignature,
} from '@/lib/printify-webhook';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const secret = process.env.PUPSON_PRINTIFY_WEBHOOK_SECRET;
  const rawBody = await request.text();
  const signature = request.headers.get('x-pfy-signature');

  if (!verifyPrintifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ received: false }, { status: 401 });
  }

  const payload = (() => {
    try {
      return JSON.parse(rawBody) as PrintifyWebhookEvent;
    } catch {
      return null;
    }
  })();

  const providerOrderId = payload ? printifyProviderOrderId(payload) : null;
  if (!payload?.type || !providerOrderId) {
    return NextResponse.json({ received: false, error: 'Invalid event.' }, { status: 400 });
  }

  const rows = await rest<
    Array<{ id: string; order_id: string; tracking: Array<Record<string, unknown>> | null }>
  >(
    `pupson_fulfillment_orders?select=id,order_id,tracking&provider_order_id=eq.${encodeURIComponent(providerOrderId)}&limit=1`
  );
  const fulfillment = rows[0];

  if (!fulfillment) {
    return NextResponse.json({ received: true, matched: false });
  }

  const status = printifyFulfillmentStatus(payload);
  const tracking = printifyTrackingPayload(payload);
  if (status || tracking) {
    const nextTracking = tracking
      ? [
          ...(fulfillment.tracking ?? []).filter(
            (entry) => String(entry.number ?? '') !== tracking.number
          ),
          tracking,
        ]
      : fulfillment.tracking ?? [];

    await rest(`pupson_fulfillment_orders?id=eq.${fulfillment.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        ...(status ? { status } : {}),
        ...(tracking ? { tracking: nextTracking } : {}),
        ...(status === 'fulfilled' ? { fulfilled_at: new Date().toISOString() } : {}),
      }),
    });
  }

  await rest('pupson_fulfillment_events?on_conflict=fulfillment_order_id,provider_event_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      fulfillment_order_id: fulfillment.id,
      provider_event_id: payload.id ?? null,
      event_type: payload.type,
      payload,
    }),
  });

  return NextResponse.json({ received: true, matched: true });
}
