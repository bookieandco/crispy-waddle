import { CheckoutOrchestrator, type CheckoutItem, type CheckoutSession } from "@jhadina/checkout-orchestrator"
import type { PaymentIntent, PaymentProvider } from "@jhadina/payment-core"
import type { CustodyEvent, Order } from "@jhadina/order-fulfillment-core"
import { createOrderGatewayFromFulfillment, createPaymentGatewayFromProvider, type CreatedOrderRecord } from "./bridge-adapters"
import {
  ConfigurablePolicyGate,
  InMemoryCheckoutStore,
  InMemoryCustodyLedger,
  InMemoryInventoryReservationAdapter,
  InMemoryManifestAdapter,
  InMemoryMerchantOrderAdapter,
  InMemoryPaymentProvider,
  DeterministicPricingService,
  type InventoryFailure,
  type PolicyGateOptions,
} from "./reference-adapters"

/**
 * Jhadina OS Integration Phase 1 — Spine Proof #2 (Commerce).
 *
 * Proves the smallest real vertical through the seven already-landed
 * commerce contracts (using three of them — checkout-orchestrator,
 * payment-core, order-fulfillment-core — the minimum needed to show a
 * complete intent -> payment -> fulfillment -> event lifecycle):
 *
 *   Commerce intent
 *     -> checkout-orchestrator (reservation, pricing, payment, order state machine)
 *     -> payment-core (via a bridge adapter, in-memory provider — no Stripe)
 *     -> order-fulfillment-core (via a bridge adapter — manifest + custody event)
 *     -> audit/event (CustodyLedger + the checkout session's own status history)
 *
 * No live provider, no credential, no Supabase dependency. The adapter
 * boundary (reference-adapters.ts, bridge-adapters.ts) is the only place
 * a real Stripe/Printify/courier integration would need to plug in later
 * — nothing in this file or the orchestrators themselves would change.
 */

export interface CommerceIntent {
  customerId: string
  items: CheckoutItem[]
}

export interface CommerceLifecycleOptions {
  inventoryFailures?: InventoryFailure[]
  paymentDeclineAtOrAboveMinor?: number
  fulfillmentPolicyDenies?: PolicyGateOptions["denyActions"]
  /**
   * Defaults to a fresh InMemoryPaymentProvider (SP-2's original
   * reference proof, unchanged). The Commerce sandbox-payment
   * milestone injects a GovernedPaymentProvider wrapping
   * StripeSandboxPaymentProvider here instead — checkout-orchestrator
   * and the bridge adapter don't change at all, only which
   * PaymentProvider implementation composes underneath them.
   * paymentDeclineAtOrAboveMinor is ignored when this is supplied; the
   * injected provider controls its own decline behavior.
   */
  paymentProvider?: PaymentProvider
}

export interface CommerceLifecycleResult {
  session: CheckoutSession
  order?: Order
  custodyEvents: CustodyEvent[]
  paymentIntents: PaymentIntent[]
}

export function createCommerceIntentCheckout(intent: CommerceIntent, now = new Date()): CheckoutSession {
  const currency = intent.items[0]?.currency ?? "USD"
  return {
    checkoutId: `checkout_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    customerId: intent.customerId,
    idempotencyKey: `intent_${now.getTime()}`,
    status: "created",
    items: intent.items,
    subtotalMinor: 0,
    taxMinor: 0,
    deliveryFeeMinor: 0,
    platformFeeMinor: 0,
    totalMinor: 0,
    currency,
    reservationIds: [],
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

/**
 * Runs one commerce intent through the full lifecycle and returns every
 * piece of resulting state — not just the checkout session — so callers
 * (and tests) can inspect what actually happened at each stage.
 */
export async function runCommerceIntentLifecycle(
  intent: CommerceIntent,
  options: CommerceLifecycleOptions = {},
): Promise<CommerceLifecycleResult> {
  const store = new InMemoryCheckoutStore()
  const inventory = new InMemoryInventoryReservationAdapter(options.inventoryFailures)
  const pricing = new DeterministicPricingService()
  const paymentProvider =
    options.paymentProvider ?? new InMemoryPaymentProvider({ declineAtOrAboveMinor: options.paymentDeclineAtOrAboveMinor })
  const payments = createPaymentGatewayFromProvider(paymentProvider)

  const merchant = new InMemoryMerchantOrderAdapter()
  const manifests = new InMemoryManifestAdapter()
  const custody = new InMemoryCustodyLedger()
  const policy = new ConfigurablePolicyGate({ denyActions: options.fulfillmentPolicyDenies })
  const createdOrders = new Map<string, CreatedOrderRecord>()
  const orders = createOrderGatewayFromFulfillment({ merchant, manifests, custody, policy }, createdOrders)

  const session = createCommerceIntentCheckout(intent)
  await store.save(session)

  const orchestrator = new CheckoutOrchestrator({ store, inventory, pricing, payments, orders })

  let finalSession: CheckoutSession
  try {
    finalSession = await orchestrator.execute(session.checkoutId)
  } catch {
    // The orchestrator already persisted a "failed" session before rethrowing;
    // surface that final state to the caller instead of the raw error, so a
    // failed lifecycle is still fully inspectable.
    finalSession = (await store.get(session.checkoutId))!
  }

  const record = finalSession.orderId ? createdOrders.get(finalSession.orderId) : undefined

  // Not part of PaymentProvider itself — checkout-orchestrator only
  // assigns session.paymentId on a *successful* authorizeOrCapture
  // call (it throws before that assignment on a decline), so deriving
  // this from the session alone would silently miss every declined
  // attempt. InMemoryPaymentProvider's own .list() inspection helper
  // is the real mechanism this file's tests rely on; the sandbox
  // provider and its governed wrapper both implement the same
  // duck-typed inspection method so this keeps working uniformly.
  const paymentIntents: PaymentIntent[] =
    "list" in paymentProvider && typeof (paymentProvider as { list?: unknown }).list === "function"
      ? (paymentProvider as { list(): PaymentIntent[] }).list()
      : []

  return {
    session: finalSession,
    order: record?.order,
    custodyEvents: record ? await custody.list(record.order.orderId) : [],
    paymentIntents,
  }
}
