// app/api/checkout/session/route.ts
//
// GET /api/checkout/session?session_id=cs_...
//
// Server-side lookup of a Stripe Checkout Session's real status, for
// the success page (app/checkout/success/page.tsx) to confirm before
// showing a confirmation or clearing the cart. This has to be a server
// route, not a direct client fetch to Stripe — reading a session
// requires the secret key, and the `session_id` in the success URL's
// query string is only a lookup key a visitor's browser can see, not
// proof of payment on its own.

import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSession } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: "Missing 'session_id' query param." },
      { status: 400 }
    );
  }

  const result = await getCheckoutSession(sessionId);
  if (!result.success) {
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result);
}
