import { NextRequest, NextResponse } from 'next/server';
import { rest } from '@/lib/platform';

export async function POST(request: NextRequest) {
  const secret = process.env.PUPSON_PRINTIFY_WEBHOOK_SECRET;
  if (!secret || request.headers.get('x-pupson-webhook-secret') !== secret)
    return NextResponse.json({ received: false }, { status: 401 });
  const payload = (await request.json().catch(() => null)) as {
    id?: string;
    type?: string;
    resource?: { id?: string; data?: { id?: string } };
  } | null;
  const providerOrderId = payload?.resource?.data?.id ?? payload?.resource?.id;
  if (!payload?.type || !providerOrderId)
    return NextResponse.json({ received: false, error: 'Invalid event.' }, { status: 400 });
  const rows = await rest<Array<{ id: string; order_id: string }>>(
    `pupson_fulfillment_orders?select=id,order_id&provider_order_id=eq.${encodeURIComponent(providerOrderId)}&limit=1`
  );
  const fulfillment = rows[0];
  if (!fulfillment) return NextResponse.json({ received: true, matched: false });
  const status = payload.type.includes('shipment:delivered')
    ? 'fulfilled'
    : payload.type.includes('shipment')
      ? 'shipped'
      : payload.type.includes('production')
        ? 'in_production'
        : undefined;
  if (status)
    await rest(`pupson_fulfillment_orders?id=eq.${fulfillment.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status,
        fulfilled_at: status === 'fulfilled' ? new Date().toISOString() : null,
      }),
    });
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
