# A5-R8 — Durable Commerce Payment Idempotency

**Status: AUDIT/REPAIR**

The Commerce Stripe sandbox provider already uses `paymentId` as the external Stripe `Idempotency-Key`, but its local `SandboxIdempotencyStore` is an in-memory `Map`. That is useful for sandbox verification but cannot be the authoritative production execution record across restarts or multiple application instances.

Required closure:

1. Add a durable payment-operation record at the existing Commerce/payment persistence boundary; do not create another gateway architecture.
2. Bind the operation to actor, action, capability, provider, payment identifier, and a canonical request fingerprint.
3. Enforce a transactional unique operation key.
4. Persist terminal provider outcome and provider reference so retries return the authoritative result without repeating the external side effect.
5. Treat timeout/unknown provider outcomes as ambiguous; reconcile or retry with the same external idempotency key, never create a new payment operation.
6. Preserve final approval consumption at the governed provider boundary; idempotency cannot bypass authorization.
7. Test concurrent claims, crash/retry, terminal-result replay, cross-actor access, fingerprint mismatch, approval replay, and expiry.
8. Keep in-memory stores test-only and require durable storage in production composition.
9. Do not mark this work complete until database/runtime/CI verification is independently evidenced.

Current source evidence: `stripe-sandbox-provider.ts` claims local idempotency by `paymentId` before its Stripe request and sends the same identifier as the Stripe idempotency key; `sandbox-idempotency.ts` stores claims/results in an in-memory `Map`.
