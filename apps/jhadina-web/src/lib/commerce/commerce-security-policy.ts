import { JHADINA_BASE_SECURITY_POLICY, type SecurityPolicy } from "@jhadina/security-core"

/**
 * Finding D implementation (Jhadina OS Integration Phase 2): the
 * Commerce capability registry, mirroring money-core's
 * MONEY_CORE_SECURITY_POLICY pattern — a *local* extension of the
 * shared base policy, not a mutation of it (unlike Growth's SP-1,
 * which added growth.draft.approve directly to
 * JHADINA_BASE_SECURITY_POLICY in security-core). Commerce has no
 * dedicated backing package the way Money does, so this lives at the
 * app composition layer instead — the pattern is what's reused, not
 * the package location.
 *
 * Approval boundary (explicit product decision, not inferred):
 * commerce.checkout is capability-only — starting/assembling an
 * intent moves no money. commerce.payment.charge and
 * commerce.payment.refund both require an explicit approval receipt —
 * either one moves real money. commerce.fulfillment is deliberately
 * NOT defined here: fulfillment-stage authorization stays entirely
 * inside order-fulfillment-core's own PolicyGate (a different
 * question — "can this order be fulfilled here" — not duplicated by
 * an actor-capability gate on top of it).
 */

export const COMMERCE_CHECKOUT_CAPABILITY = "commerce.checkout"
export const COMMERCE_PAYMENT_CHARGE_CAPABILITY = "commerce.payment.charge"
export const COMMERCE_PAYMENT_REFUND_CAPABILITY = "commerce.payment.refund"

export const COMMERCE_SECURITY_POLICY: SecurityPolicy = {
  ...JHADINA_BASE_SECURITY_POLICY,
  allowedCapabilities: [
    ...JHADINA_BASE_SECURITY_POLICY.allowedCapabilities,
    COMMERCE_CHECKOUT_CAPABILITY,
    COMMERCE_PAYMENT_CHARGE_CAPABILITY,
    COMMERCE_PAYMENT_REFUND_CAPABILITY,
  ],
  approvalCapabilities: [
    ...JHADINA_BASE_SECURITY_POLICY.approvalCapabilities,
    COMMERCE_PAYMENT_CHARGE_CAPABILITY,
    COMMERCE_PAYMENT_REFUND_CAPABILITY,
  ],
}
