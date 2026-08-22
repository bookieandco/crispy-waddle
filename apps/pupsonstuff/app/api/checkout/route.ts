// app/api/checkout/route.ts
//
// POST /api/checkout
// JSON body: { items: CartItem[] }
//
// Creates a real Stripe Checkout Session (lib/stripe.ts) and returns
// its hosted URL for the client to redirect to. Returns an honest
// "not configured" error without STRIPE_SECRET_KEY set, same pattern
// as every other AI/fulfillment route in this app — never a faked
// success.
//
// success_url/cancel_url are built from the request's own origin
// (`req.nextUrl.origin`) rather than a hardcoded env var — this route
// has no way to know its own public URL otherwise (dev vs. preview vs.
// production all differ), and Next.js's own `NextRequest.nextUrl`
// already carries the real request origin.

import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { CartItem } from "@/types/boutique";

function isCartItem(x: unknown): x is CartItem {
  if (typeof x !== "object" || x === null) return false;
  const item = x as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.productName === "string" &&
    typeof item.price === "number" &&
    item.price > 0 &&
    typeof item.quantity === "number" &&
    item.quantity >= 1 &&
    (item.previewUrl === undefined || typeof item.previewUrl === "string")
  );
}

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

  const items = (body as { items?: unknown })?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { success: false, error: "Missing or empty 'items' array." },
      { status: 400 }
    );
  }
  if (!items.every(isCartItem)) {
    return NextResponse.json(
      { success: false, error: "One or more cart items are malformed." },
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
