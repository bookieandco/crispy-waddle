// app/api/checkout/route.ts
//
// POST /api/checkout
// JSON body: { items: CartItem[] }
//
// IMPORTANT: the browser cart is untrusted. Product names and prices are
// re-resolved from data/hotspots.ts before Stripe sees a line item.

import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { validateCart } from "@/lib/catalog";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Expected a JSON body." },
      { status: 400 }
    );
  }

  const items = validateCart((body as { items?: unknown })?.items);
  if (!items) {
    return NextResponse.json(
      { success: false, error: "One or more cart items are invalid or no longer available." },
      { status: 400 }
    );
  }

  const origin = req.nextUrl.origin;
  const result = await createCheckoutSession({
    items,
    successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/`,
  });

  if (!result.success) {
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result);
}
