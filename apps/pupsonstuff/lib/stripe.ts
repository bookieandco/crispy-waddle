// lib/stripe.ts
// Server-only. Never import this from a client component.

import Stripe from "stripe";
import { ValidatedCartItem } from "@/lib/catalog";

let client: Stripe | null = null;

function getClient(secretKey: string): Stripe {
  if (!client) client = new Stripe(secretKey);
  return client;
}

export interface CreateCheckoutSessionParams {
  items: ValidatedCartItem[];
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
            name: `${item.productName} — ${item.variantLabel}`,
            metadata: {
              cart_entry_id: item.id,
              product_id: item.productId,
              variant_id: item.variantId,
              art_style: item.artStyle,
            },
            images: item.previewUrl?.startsWith("http")
              ? [item.previewUrl]
              : undefined,
          },
          unit_amount: item.priceCents,
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

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  return secretKey ? getClient(secretKey) : null;
}
