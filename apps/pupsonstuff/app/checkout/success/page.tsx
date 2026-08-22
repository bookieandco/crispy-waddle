import { Suspense } from "react";
import CheckoutSuccessContent from "@/components/CheckoutSuccessContent";

export const metadata = { title: "Order Confirmed — PupsonStuff" };

// CheckoutSuccessContent uses useSearchParams (reads Stripe's
// ?session_id=... redirect param), which Next.js requires to be inside
// a Suspense boundary — this file stays a server component specifically
// so that boundary can live here, one layer above the "use client" logic.
export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-cream">
          <p className="text-sm text-ink/60">Loading…</p>
        </main>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
