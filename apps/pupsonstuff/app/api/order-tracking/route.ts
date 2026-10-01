import { NextRequest, NextResponse } from 'next/server';
import { getCheckoutSession } from '@/lib/stripe';
import { rest } from '@/lib/platform';

export const runtime = 'nodejs';

interface OrderRow {
  id: string;
  fulfillment_status: string;
  created_at: string;
  paid_at: string | null;
}

interface FulfillmentRow {
  status: string;
  provider: string;
  tracking: unknown;
  submitted_at: string | null;
  fulfilled_at: string | null;
  last_error: string | null;
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id')?.trim();
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return NextResponse.json(
      { success: false, error: 'A valid checkout session is required.' },
      { status: 400 }
    );
  }

  const stripe = await getCheckoutSession(sessionId);
  if (!stripe.success) {
    return NextResponse.json({ success: false, error: stripe.error }, { status: 404 });
  }
  if (stripe.session.paymentStatus !== 'paid') {
    return NextResponse.json({
      success: true,
      paymentStatus: stripe.session.paymentStatus,
      orderStatus: 'awaiting_payment',
      fulfillmentStatus: 'pending',
      tracking: [],
    });
  }

  const orders = await rest<OrderRow[]>(
    `pupson_orders?select=id,fulfillment_status,created_at,paid_at&stripe_session_id=eq.${encodeURIComponent(sessionId)}&limit=1`
  );
  const order = orders[0];
  if (!order) {
    return NextResponse.json({
      success: true,
      paymentStatus: 'paid',
      orderStatus: 'recording',
      fulfillmentStatus: 'pending',
      tracking: [],
    });
  }

  const fulfillments = await rest<FulfillmentRow[]>(
    `pupson_fulfillment_orders?select=status,provider,tracking,submitted_at,fulfilled_at,last_error&order_id=eq.${order.id}&limit=1`
  );
  const fulfillment = fulfillments[0];

  return NextResponse.json({
    success: true,
    paymentStatus: 'paid',
    orderId: order.id,
    orderStatus: 'paid',
    fulfillmentStatus: fulfillment?.status ?? order.fulfillment_status ?? 'pending',
    provider: fulfillment?.provider ?? 'printify',
    tracking: Array.isArray(fulfillment?.tracking) ? fulfillment.tracking : [],
    submittedAt: fulfillment?.submitted_at ?? null,
    fulfilledAt: fulfillment?.fulfilled_at ?? null,
    attentionRequired: fulfillment?.status === 'failed' || fulfillment?.status === 'blocked',
  });
}
