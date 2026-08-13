import type { CheckoutItem, OrderGateway, PaymentGateway, Reservation } from "@jhadina/checkout-orchestrator"
import { assertSameCurrency, type PaymentIntentRequest, type PaymentProvider } from "@jhadina/payment-core"
import { FulfillmentOrchestrator, type CustodyLedger, type ManifestAdapter, type MerchantOrderAdapter, type Order, type PolicyGate } from "@jhadina/order-fulfillment-core"
import { REFERENCE_FULFILLMENT_POLICY, toFulfillmentItems } from "./reference-adapters"

/**
 * The actual composition proof: checkout-orchestrator, payment-core, and
 * order-fulfillment-core were designed independently (each has its own
 * package.json, none depends on either of the other two) and each
 * defines its own boundary interface at a different level of detail.
 * These two functions are the glue that makes them run as one lifecycle
 * — and the place where any genuine incompatibility between the three
 * contracts would surface.
 */

// ---------------------------------------------------------------------
// checkout-orchestrator.PaymentGateway <- payment-core.PaymentProvider
// ---------------------------------------------------------------------

/**
 * checkout-orchestrator's PaymentGateway only carries a single netted
 * amountMinor (tax/delivery/platform fee are already folded in by the
 * time payment is called) — it doesn't expose per-line detail. payment-
 * core's PaymentIntentRequest wants a fuller breakdown (lines/taxes/
 * platformFees) for its own ledger. This bridge represents the netted
 * checkout total as a single opaque payment line with no separate tax/
 * fee lines, since checkout-orchestrator has already resolved those
 * before payment; a richer bridge that forwarded the real breakdown
 * would need checkout-orchestrator to pass FinalPrice through to
 * authorizeOrCapture(), which its own interface doesn't do today.
 */
export function createPaymentGatewayFromProvider(provider: PaymentProvider): PaymentGateway {
  return {
    async authorizeOrCapture(input) {
      const amount = { amountMinor: input.amountMinor, currency: input.currency }
      assertSameCurrency(amount)

      const request: PaymentIntentRequest = {
        paymentId: input.paymentId,
        orderId: input.checkoutId,
        customer: { id: input.customerId, type: "customer" },
        seller: { id: "platform", type: "platform" },
        amount,
        lines: [{ id: `${input.checkoutId}:total`, description: "Checkout total", amount }],
        taxes: [],
        platformFees: [],
        metadata: { idempotencyKey: input.idempotencyKey },
      }

      const intent = await provider.createPaymentIntent(request)

      if (intent.status === "captured" || intent.status === "authorized") {
        return { paymentId: intent.paymentId, status: intent.status, providerReference: intent.providerReference }
      }
      return { paymentId: intent.paymentId, status: "failed", providerReference: intent.providerReference }
    },

    async refund(input) {
      await provider.refund({
        refundId: `refund_${input.paymentId}_${Date.now()}`,
        paymentId: input.paymentId,
        reason: mapRefundReason(input.reason),
        requestedBy: "checkout-orchestrator",
      })
    },
  }
}

/**
 * checkout-orchestrator's refund reason is a free-form string (its own
 * code passes literal strings like "checkout_failed"); payment-core
 * constrains RefundRequest.reason to a fixed taxonomy. This is a
 * legitimate translation, not a workaround: checkout-orchestrator was
 * never designed against payment-core's specific reason vocabulary, so
 * the bridge is the correct place to normalize it, and the mapping is
 * conservative (unrecognized reasons fall through to "other" rather
 * than guessing).
 */
function mapRefundReason(reason: string): "customer_request" | "order_cancelled" | "delivery_failed" | "compliance" | "other" {
  if (reason.includes("checkout_failed") || reason.includes("cancel")) return "order_cancelled"
  if (reason.includes("customer")) return "customer_request"
  if (reason.includes("delivery") || reason.includes("fulfillment")) return "delivery_failed"
  if (reason.includes("compliance")) return "compliance"
  return "other"
}

// ---------------------------------------------------------------------
// checkout-orchestrator.OrderGateway <- order-fulfillment-core.FulfillmentOrchestrator
// ---------------------------------------------------------------------

export interface OrderGatewayDeps {
  merchant: MerchantOrderAdapter
  manifests: ManifestAdapter
  custody: CustodyLedger
  policy: PolicyGate
}

export interface CreatedOrderRecord {
  order: Order
  manifestId: string
}

/**
 * checkout-orchestrator's OrderGateway.createOrder() only needs to
 * return { orderId }. order-fulfillment-core's Order additionally
 * requires merchantId/locationId/jurisdictionId/policyVersion that
 * checkout-orchestrator's CheckoutItem never carries per-checkout (only
 * per-item merchantId/locationId, since a checkout can in principle span
 * multiple merchants) and never carries jurisdiction at all. This bridge
 * makes both of those an explicit, fail-closed decision rather than a
 * silent guess:
 *   - it requires every item in the checkout to share one merchantId
 *     and one locationId (a genuine, real limitation of composing these
 *     two contracts for a multi-merchant marketplace checkout — out of
 *     scope for this proof, not silently papered over);
 *   - jurisdiction and policyVersion come from an explicit
 *     FulfillmentPolicy the caller supplies (REFERENCE_FULFILLMENT_POLICY
 *     by default), not invented inside the bridge.
 */
export function createOrderGatewayFromFulfillment(
  deps: OrderGatewayDeps,
  createdOrders: Map<string, CreatedOrderRecord>,
  policy = REFERENCE_FULFILLMENT_POLICY,
): OrderGateway {
  const orchestrator = new FulfillmentOrchestrator(deps)

  return {
    async createOrder(input) {
      const merchantIds = new Set(input.items.map((item: CheckoutItem) => item.merchantId))
      const locationIds = new Set(input.items.map((item: CheckoutItem) => item.locationId))
      if (merchantIds.size > 1 || locationIds.size > 1) {
        throw new Error(
          "Multi-merchant or multi-location checkouts are not supported by this reference fulfillment bridge — split into separate orders upstream.",
        )
      }
      const [merchantId] = merchantIds
      const [locationId] = locationIds
      if (!merchantId || !locationId) {
        throw new Error("Cannot create a fulfillment order with no items")
      }

      const order: Order = {
        orderId: `order_${input.checkoutId}`,
        checkoutId: input.checkoutId,
        customerId: input.customerId,
        merchantId,
        locationId,
        status: "created",
        items: toFulfillmentItems(input.items, input.reservations as Reservation[]),
        paymentId: input.paymentId,
        policyVersion: policy.policyVersion,
        jurisdictionId: policy.jurisdictionId,
        custodyStatus: "merchant_control",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const manifest = await orchestrator.create(order, policy)
      createdOrders.set(order.orderId, { order, manifestId: manifest.manifestId })

      return { orderId: order.orderId }
    },
  }
}
