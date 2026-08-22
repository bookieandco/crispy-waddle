// lib/stripe.ts
//
// Server-only. Never import this from a client component — it reads
// process.env.STRIPE_SECRET_KEY, which must never reach the browser.
//
// UNTESTED against a live key — no network access to api.stripe.com
// from the sandbox that wrote this, the same honest caveat as every
// other external API integration in this project (lib/ai.ts,
// lib/animation.ts, lib/muapi.ts, lib/printify.ts). Treat the first
// real checkout attempt as a test.
//
// apiVersion deliberately left unset in the Stripe client constructor
// below — the installed `stripe` SDK's own `apiVersion?` option accepts
// it, but pinning a specific dated version string here would mean
// guessing at one rather than knowing it's actually current, which this
// project avoids everywhere else. Omitting it uses the SDK's own bundled
// default (Stripe's documented behavior for the Node library), which
// tracks the installed package version instead of a hand-picked string
// that could quietly drift out of date.

import Stripe from "stripe";
import { CartItem } from "@/types/boutique";

let client: Stripe | null = null;

function getClient(secretKey: string): Stripe {
  if (!client) client = new Stripe(secretKey);
  return client;
}

export interface CreateCheckoutSessionParams {
  items: CartItem[];
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutSessionResult {
  success: true;
  url: string;
}

export interface CreateCheckoutSessionError {
  success: false;
  error: string;
}

/**
 * Creates a real Stripe Checkout Session and returns its hosted URL for
 * the client to redirect to (`window.location.href = url`) — the
 * redirect-to-Stripe-hosted-page flow, not Stripe.js/Elements embedded
 * on this page, so no client-side Stripe publishable key or
 * `@stripe/stripe-js` dependency is needed anywhere in this app.
 *
 * Line items are built with `price_data` (inline pricing), not
 * pre-created Stripe Price/Product objects — there's no Stripe catalog
 * synced to this app's products (same situation as Printify/Printful:
 * `data/hotspots.ts` is this app's only product source of truth), so
 * each checkout constructs its prices from the cart at request time.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CreateCheckoutSessionResult | CreateCheckoutSessionError> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { success: false, error: "STRIPE_SECRET_KEY is not configured." };
  }
  if (params.items.length === 0) {
    return { success: false, error: "Cart is empty." };
  }

  try {
    const stripe = getClient(secretKey);

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] =
      params.items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "usd",
          product_data: {
            name: item.productName,
            // Stripe requires image URLs to be publicly reachable
            // (it fetches them) — a data: URL (what this app's
            // generated previews actually are, from
            // app/api/generate-preview/route.ts's base64 response)
            // is not that, so it's deliberately excluded rather than
            // sent and silently rejected/ignored by Stripe.
            images: item.previewUrl?.startsWith("http")
              ? [item.previewUrl]
              : undefined,
          },
          unit_amount: item.price,
        },
      }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    if (!session.url) {
      return { success: false, error: "Stripe did not return a session URL." };
    }
    return { success: true, url: session.url };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error calling Stripe.",
    };
  }
}

export interface CheckoutSessionSummary {
  status: Stripe.Checkout.Session["status"];
  paymentStatus: Stripe.Checkout.Session["payment_status"];
  amountTotalCents: number | null;
  currency: string | null;
  customerEmail: string | null;
}

/**
 * Fetches a Checkout Session's real status server-side — the success
 * page needs this because Stripe's own `session_id` query param is not
 * itself proof of payment (anyone can craft that URL), only a lookup
 * key; the actual status has to come from Stripe's API using the
 * secret key, which is exactly why this can't be a direct client-side
 * fetch to Stripe.
 */
export async function getCheckoutSession(
  sessionId: string
): Promise<{ success: true; session: CheckoutSessionSummary } | CreateCheckoutSessionError> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { success: false, error: "STRIPE_SECRET_KEY is not configured." };
  }
  try {
    const stripe = getClient(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      success: true,
      session: {
        status: session.status,
        paymentStatus: session.payment_status,
        amountTotalCents: session.amount_total,
        currency: session.currency,
        customerEmail: session.customer_details?.email ?? null,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error calling Stripe.",
    };
  }
}
