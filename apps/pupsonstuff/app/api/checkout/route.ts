import { NextResponse } from "next/server";
import Stripe from "stripe";
import { hotspots } from "@/data/hotspots";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-02-25.clover",
});

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is not configured yet." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as {
      productId?: string;
      variantId?: string;
      quantity?: number;
      previewUrl?: string | null;
    };

    const product = hotspots.find((item) => item.id === body.productId);
    const variant = product?.fulfillment?.variants.find(
      (item) => item.variantId === body.variantId
    );

    if (!product?.fulfillment || !variant) {
      return NextResponse.json({ error: "Product or variant not found." }, { status: 400 });
    }

    const quantity = Math.min(Math.max(Math.floor(body.quantity ?? 1), 1), 20);
    const origin = request.headers.get("origin") ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity,
          price_data: {
            currency: "usd",
            unit_amount: variant.priceCents,
            product_data: {
              name: product.name,
              description: `${variant.label}${body.previewUrl ? " · Custom pet artwork" : ""}`,
              ...(body.previewUrl ? { images: [body.previewUrl] } : {}),
            },
          },
        },
      ],
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      metadata: {
        pupsonProductId: product.id,
        variantId: variant.variantId,
        provider: product.fulfillment.provider,
        fulfillmentProductId: product.fulfillment.productId,
        previewGenerated: body.previewUrl ? "true" : "false",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("PupsonStuff Stripe Checkout error", error);
    return NextResponse.json({ error: "Unable to start checkout." }, { status: 500 });
  }
}
