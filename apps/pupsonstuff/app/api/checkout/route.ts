// app/api/checkout/route.ts
//
// POST /api/checkout
// JSON body: { items: CartItem[] }
//
// IMPORTANT: the browser cart is untrusted. Product names and prices are
// re-resolved from data/hotspots.ts before Stripe sees a line item.

import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/stripe';
import { validateCart } from '@/lib/catalog';
import { certifyCartForCheckout } from '@/lib/checkout-readiness';
import { OWNER_COOKIE } from '@/lib/platform';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Expected a JSON body.' }, { status: 400 });
  }

  const items = validateCart((body as { items?: unknown })?.items);
  if (!items) {
    return NextResponse.json(
      { success: false, error: 'One or more cart items are invalid or no longer available.' },
      { status: 400 }
    );
  }

  const ownerToken = req.cookies.get(OWNER_COOKIE)?.value;
  if (!ownerToken)
    return NextResponse.json(
      { success: false, error: 'Your creative session expired. Please approve the artwork again.' },
      { status: 401 }
    );
  let certifiedItems;
  try {
    certifiedItems = await certifyCartForCheckout(items, ownerToken);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cart is not ready for production.',
      },
      { status: 409 }
    );
  }
  const origin = process.env.PUPSON_PUBLIC_ORIGIN ?? req.nextUrl.origin;
  const result = await createCheckoutSession({
    items: certifiedItems,
    successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/`,
  });

  if (!result.success) {
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result);
}
