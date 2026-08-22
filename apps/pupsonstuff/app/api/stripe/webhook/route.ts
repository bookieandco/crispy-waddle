import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { validateStripeLineItems } from "@/lib/catalog";
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
    return NextResponse.json({ received: true, paid: false });
  }

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100,
      expand: ["data.price.product"],
    });

    const rawItems = lineItems.data.map((lineItem) => {
      const product = lineItem.price?.product;
      // `product` is typed as `Stripe.Product | Stripe.DeletedProduct` once
      // expanded — a real, narrow type-check failure caught here, not
      // present before: DeletedProduct has neither `metadata` nor `name`
      // (it's just `{ id, object: "product", deleted: true }`). A product
      // can genuinely be deleted from the catalog after a Checkout Session
      // was created but before this webhook fires, so this isn't a
      // theoretical case to wave off with an `any`.
      const isActiveProduct =
        typeof product === "object" && product !== null && !("deleted" in product && product.deleted);
      const metadata = isActiveProduct ? product.metadata : {};

      return {
        // Stripe's line-item ID is the durable idempotency key. Never use
        // browser cart IDs for webhook replay protection.
        id: lineItem.id,
        productId: metadata.product_id,
        variantId: metadata.variant_id,
        artStyle: metadata.art_style,
        productName: isActiveProduct ? product.name : "",
        price: lineItem.price?.unit_amount ?? 0,
        quantity: lineItem.quantity ?? 0,
      };
    });

    // The catalog is consulted to recover the current fulfillment mapping,
    // but Stripe's already-paid unit amount remains the historical order
    // price. A catalog price change therefore cannot rewrite an old order.
    const items = validateStripeLineItems(rawItems);
    if (!items || items.length !== rawItems.length) {
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
