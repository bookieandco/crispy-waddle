import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { validateCart } from "@/lib/catalog";
import { upsertPaidOrder } from "@/lib/orders";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { success: false, error: "Stripe webhook is not configured." },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { success: false, error: "Missing Stripe-Signature header." },
      { status: 400 }
    );
  }

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid Stripe webhook signature." },
      { status: 400 }
    );
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    // Do not create a paid order for an unpaid/async-pending session.
    return NextResponse.json({ received: true, paid: false });
  }

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100,
      expand: ["data.price.product"],
    });

    const rawItems = lineItems.data.map((lineItem) => {
      const product = lineItem.price?.product;
      const metadata = typeof product === "object" && product !== null
        ? product.metadata
        : {};

      return {
        id: metadata.cart_entry_id ?? lineItem.id,
        productId: metadata.product_id,
        variantId: metadata.variant_id,
        artStyle: metadata.art_style,
        productName: typeof product === "object" && product !== null
          ? product.name
          : "",
        price: lineItem.price?.unit_amount ?? 0,
        quantity: lineItem.quantity ?? 0,
      };
    });

    const items = validateCart(rawItems);
    if (!items || items.length !== rawItems.length) {
      // A paid session with malformed catalog metadata is intentionally
      // not silently turned into an order. Stripe can retry after the
      // deployment is corrected, while the payment remains visible in
      // Stripe for manual reconciliation.
      return NextResponse.json(
        { success: false, error: "Stripe line-item catalog metadata failed validation." },
        { status: 422 }
      );
    }

    const order = await upsertPaidOrder(
      {
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        customerEmail: session.customer_details?.email ?? null,
        currency: session.currency ?? null,
        amountTotalCents: session.amount_total,
        stripeCreatedAt: session.created
          ? new Date(session.created * 1000).toISOString()
          : null,
        paidAt: new Date().toISOString(),
      },
      items
    );

    return NextResponse.json({ received: true, orderId: order.id });
  } catch (error) {
    console.error("PupsonStuff Stripe webhook order persistence failed", error);
    return NextResponse.json(
      { success: false, error: "Order persistence failed; Stripe should retry this event." },
      { status: 500 }
    );
  }
}
