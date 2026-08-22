import {
  COMMERCE_CHECKOUT_CAPABILITY,
  COMMERCE_PAYMENT_CHARGE_CAPABILITY,
  COMMERCE_PAYMENT_REFUND_CAPABILITY,
} from "./commerce-security-policy"

/**
 * Step 8 (Event Bus + Capability Registry): what a Commerce actor can
 * potentially request — not an authorization decision. This registry
 * only describes capabilities; it grants nothing. The actual decision
 * for any given request is still made exclusively by
 * SecurityCoreActionPolicy(COMMERCE_SECURITY_POLICY) (see
 * commerce-security-policy.ts) and, for money-moving capabilities, the
 * explicit human-approval receipt lifecycle (commerce-proposal-lifecycle.ts).
 * Nothing in this file evaluates policy, issues a receipt, or executes
 * anything.
 *
 * Every entry here is either genuinely implemented (has a real,
 * governed code path today) or explicitly marked "not_implemented" —
 * never silently pretended into existence. "not_implemented" entries
 * exist because the capability constant and its policy/executor-level
 * denial already exist in code (GovernedPaymentProvider's own
 * CAPABILITY_ALLOWED map, StripeSandboxPaymentProvider's
 * createPayout()/reconcile()), so the registry names them for
 * discoverability rather than omitting them and letting a caller
 * assume they don't exist at all.
 */

export type CommerceCapability =
  | typeof COMMERCE_CHECKOUT_CAPABILITY
  | typeof COMMERCE_PAYMENT_CHARGE_CAPABILITY
  | typeof COMMERCE_PAYMENT_REFUND_CAPABILITY
  | "commerce.payment.payout"
  | "commerce.payment.reconcile"

export type CommerceCapabilityRisk = "reversible" | "financial"
export type CommerceCapabilityStatus = "implemented" | "not_implemented"

export interface CommerceCapabilityDefinition {
  risk: CommerceCapabilityRisk
  /** Whether SecurityCoreActionPolicy(COMMERCE_SECURITY_POLICY) requires an explicit approval receipt for this capability today. */
  requiresApproval: boolean
  status: CommerceCapabilityStatus
  description: string
}

const DEFINITIONS: Record<CommerceCapability, CommerceCapabilityDefinition> = {
  [COMMERCE_CHECKOUT_CAPABILITY]: {
    risk: "reversible",
    requiresApproval: false,
    status: "implemented",
    description: "Starts/assembles a checkout intent. Moves no money by itself — see commerce-security-policy.ts's approval-boundary note.",
  },
  [COMMERCE_PAYMENT_CHARGE_CAPABILITY]: {
    risk: "financial",
    requiresApproval: true,
    status: "implemented",
    description: "Charges a payment via the governed proposal lifecycle (propose -> approve -> execute) against Stripe sandbox/test only. Live-verified in Phase 4.7.",
  },
  [COMMERCE_PAYMENT_REFUND_CAPABILITY]: {
    risk: "financial",
    requiresApproval: true,
    status: "implemented",
    description: "Refunds a captured payment. Approval-gated identically to charge; proven in governed-commerce-intent.ts's own checkout path, not yet wired into the proposal lifecycle's three HTTP routes.",
  },
  "commerce.payment.payout": {
    risk: "financial",
    requiresApproval: true,
    status: "not_implemented",
    description: "Named and explicitly denied (GovernedPaymentProvider.CAPABILITY_ALLOWED['commerce.payment.payout'] = false; StripeSandboxPaymentProvider.createPayout() always throws). No executor exists yet.",
  },
  "commerce.payment.reconcile": {
    risk: "financial",
    requiresApproval: true,
    status: "not_implemented",
    description: "Named and explicitly denied (GovernedPaymentProvider.CAPABILITY_ALLOWED['commerce.payment.reconcile'] = false; StripeSandboxPaymentProvider.reconcile() always throws). No executor exists yet.",
  },
}

export function getCommerceCapability(capability: CommerceCapability): CommerceCapabilityDefinition {
  return DEFINITIONS[capability]
}

export function isCommerceCapability(value: string): value is CommerceCapability {
  return Object.prototype.hasOwnProperty.call(DEFINITIONS, value)
}

export function isCommerceCapabilityImplemented(capability: CommerceCapability): boolean {
  return DEFINITIONS[capability].status === "implemented"
}

export function listCommerceCapabilities(): readonly CommerceCapability[] {
  return Object.keys(DEFINITIONS) as CommerceCapability[]
}
