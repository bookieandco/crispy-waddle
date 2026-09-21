import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import { validateStripeLineItems } from '@/lib/catalog';
import { upsertPaidOrder } from '@/lib/orders';
import { queueFulfillment } from '@/lib/fulfillment-bridge';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { success: false, error: 'Stripe webhook is not configured.' },
      { status: 503 }
    );
  }
  const signature = req.headers.get('stripe-signature');
  if (!signature)
    return NextResponse.json(
      { success: false, error: 'Missing Stripe-Signature header.' },
      { status: 400 }
    );

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid Stripe webhook signature.' },
      { status: 400 }
    );
  }

  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded'
  ) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== 'paid') return NextResponse.json({ received: true, paid: false });

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100,
      expand: ['data.price.product'],
    });
    const rawItems = lineItems.data.map((lineItem) => {
      const product = lineItem.price?.product;
      // `product` is `Stripe.Product | Stripe.DeletedProduct | string`.
      // A deleted product still expands to an object, but one with no
      // `metadata`/`name` — Stripe's own discriminant is `deleted`
      // (`true` on DeletedProduct, absent/void on a live Product), so a
      // deleted product is treated the same as an unexpanded string id:
      // no metadata available, which validateStripeLineItems below will
      // correctly reject rather than silently accepting.
      const liveProduct =
        typeof product === 'object' && product !== null && !product.deleted ? product : null;
      const metadata = liveProduct?.metadata ?? {};
      return {
        // The Stripe line-item ID is the durable idempotency key.
        id: lineItem.id,
        productId: metadata.product_id,
        variantId: metadata.variant_id,
        artStyle: metadata.art_style,
        creativeOutputId: metadata.creative_output_id,
        printAssetId: metadata.print_asset_id,
        fulfillmentProvider: metadata.fulfillment_provider,
        providerProductId: metadata.provider_product_id,
        providerVariantId: metadata.provider_variant_id,
        blueprintId: metadata.blueprint_id,
        printProviderId: metadata.print_provider_id,
        printArea: metadata.print_area,
        catalogCertificationStatus: metadata.catalog_certification_status,
        productName: liveProduct?.name ?? '',
        // Preserve the historical amount actually charged by Stripe.
        price: lineItem.price?.unit_amount ?? 0,
        quantity: lineItem.quantity ?? 0,
      };
    });

    // Current catalog resolves fulfillment identity; Stripe remains the
    // source of truth for the historical amount paid.
    const items = validateStripeLineItems(rawItems);
    if (!items || items.length !== rawItems.length) {
      return NextResponse.json(
        { success: false, error: 'Stripe line-item catalog metadata failed validation.' },
        { status: 422 }
      );
    }

    const shipping = session.collected_information?.shipping_details;

    const order = await upsertPaidOrder(
      {
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
        customerEmail: session.customer_details?.email ?? null,
        currency: session.currency ?? null,
        amountTotalCents: session.amount_total,
        stripeCreatedAt: session.created ? new Date(session.created * 1000).toISOString() : null,
        paidAt: new Date().toISOString(),
        customerName: shipping?.name ?? session.customer_details?.name ?? null,
        customerPhone: session.customer_details?.phone ?? null,
        shippingAddress: shipping?.address ?? session.customer_details?.address ?? null,
      },
      items
    );
    const fulfillmentId = await queueFulfillment(order.id);

    return NextResponse.json({ received: true, orderId: order.id, fulfillmentId });
  } catch (error) {
    console.error('PupsonStuff Stripe webhook order persistence failed', error);
    return NextResponse.json(
      { success: false, error: 'Order persistence failed; Stripe should retry this event.' },
      { status: 500 }
    );
  }
}
