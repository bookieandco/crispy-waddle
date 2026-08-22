"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/context/CartContext";

type State =
  | { status: "loading" }
  | { status: "missing-session" }
  | { status: "error"; message: string }
  | {
      status: "confirmed";
      paid: boolean;
      amountTotalCents: number | null;
      customerEmail: string | null;
    };

const centsToPrice = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { clearCart } = useCart();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!sessionId) {
      setState({ status: "missing-session" });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/checkout/session?session_id=${encodeURIComponent(sessionId)}`
        );
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok || !data.success) {
          setState({
            status: "error",
            message: data?.error ?? "Couldn't confirm your order.",
          });
          return;
        }

        const paid = data.session.paymentStatus === "paid";
        // Only clear the cart once payment is actually confirmed server-
        // side — never on page load alone. The session_id in this page's
        // URL is just a lookup key anyone could type in; it's this fetch
        // (which required the real STRIPE_SECRET_KEY server-side) that
        // establishes whether anything was actually paid for.
        if (paid) clearCart();

        setState({
          status: "confirmed",
          paid,
          amountTotalCents: data.session.amountTotalCents,
          customerEmail: data.session.customerEmail,
        });
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            message: "Couldn't reach the server to confirm your order.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
      <div className="max-w-md">
        {state.status === "loading" && (
          <p className="text-sm text-ink/60">Confirming your order…</p>
        )}

        {state.status === "missing-session" && (
          <>
            <h1 className="font-display text-2xl text-ink">
              No order to confirm
            </h1>
            <p className="mt-2 text-sm text-ink/60">
              This page is meant to be reached from Stripe after checkout —
              there&apos;s no session to look up here.
            </p>
          </>
        )}

        {state.status === "error" && (
          <>
            <h1 className="font-display text-2xl text-ink">
              Couldn&apos;t confirm your order
            </h1>
            <p className="mt-2 text-sm text-ink/60">{state.message}</p>
            <p className="mt-2 text-xs text-ink/40">
              If you were actually charged, this is a confirmation-lookup
              problem, not a billing one — check your email for a Stripe
              receipt, or contact support with your payment details.
            </p>
          </>
        )}

        {state.status === "confirmed" && state.paid && (
          <>
            <h1 className="font-display text-2xl text-ink">
              Thank you — order confirmed
            </h1>
            <p className="mt-2 text-sm text-ink/60">
              {state.amountTotalCents !== null
                ? `${centsToPrice(state.amountTotalCents)} charged`
                : "Payment confirmed"}
              {state.customerEmail ? ` — a receipt was sent to ${state.customerEmail}.` : "."}
            </p>
            <p className="mt-2 text-xs text-ink/40">
              Order fulfillment/tracking isn&apos;t wired up yet in this
              build — there&apos;s no order-history page to send you to.
              This confirmation is real; what happens after payment isn&apos;t
              automated yet.
            </p>
          </>
        )}

        {state.status === "confirmed" && !state.paid && (
          <>
            <h1 className="font-display text-2xl text-ink">
              Payment not completed
            </h1>
            <p className="mt-2 text-sm text-ink/60">
              This checkout session exists but isn&apos;t marked as paid —
              your cart hasn&apos;t been cleared. If you completed payment
              and see this, please contact support with this page&apos;s
              URL.
            </p>
          </>
        )}

        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-honey-oak px-6 py-3 text-sm font-medium text-cream transition hover:bg-bronze"
        >
          Back to the boutique
        </Link>
      </div>
    </main>
  );
}
