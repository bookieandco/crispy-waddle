import type {
  CheckoutItem,
  CheckoutSession,
  CheckoutStore,
  FinalPrice,
  InventoryReservationAdapter,
  PricingService,
  Reservation,
  ReservationRequest,
} from "@jhadina/checkout-orchestrator"
import type { Money, PaymentIntent, PaymentIntentRequest, PaymentProvider, RefundRequest } from "@jhadina/payment-core"
import type {
  CustodyEvent,
  CustodyLedger,
  FulfillmentItem,
  FulfillmentPolicy,
  Manifest,
  ManifestAdapter,
  MerchantOrderAdapter,
  Order,
  PolicyGate,
} from "@jhadina/order-fulfillment-core"

/**
 * Reference (in-memory, deterministic) adapters for Commerce Spine Proof
 * #2. None of these talk to a real provider — no Stripe, no Printify, no
 * live courier API, no Supabase. They exist to prove the seven commerce
 * contracts actually compose into one working lifecycle, with a boundary
 * clean enough that a real provider can be substituted later without
 * touching any orchestrator.
 */

// ---------------------------------------------------------------------
// checkout-orchestrator adapters
// ---------------------------------------------------------------------

export class InMemoryCheckoutStore implements CheckoutStore {
  private readonly sessions = new Map<string, CheckoutSession>()

  async get(checkoutId: string): Promise<CheckoutSession | null> {
    const session = this.sessions.get(checkoutId)
    return session ? { ...session, items: [...session.items], reservationIds: [...session.reservationIds] } : null
  }

  async save(session: CheckoutSession): Promise<void> {
    this.sessions.set(session.checkoutId, { ...session, items: [...session.items], reservationIds: [...session.reservationIds] })
  }

  /** Test/inspection helper — the append-only history is approximated by re-reading saved snapshots. */
  snapshot(checkoutId: string): CheckoutSession | undefined {
    const session = this.sessions.get(checkoutId)
    return session ? { ...session } : undefined
  }
}

export interface InventoryFailure {
  productId: string
  reason: string
}

/**
 * Reserves against an in-memory stock table. Configurable to fail a
 * specific product, so tests can prove the checkout orchestrator's own
 * release-on-failure path actually runs.
 */
export class InMemoryInventoryReservationAdapter implements InventoryReservationAdapter {
  private readonly reservations = new Map<string, Reservation>()
  private readonly failures: InventoryFailure[]

  constructor(failures: InventoryFailure[] = []) {
    this.failures = failures
  }

  async reserve(request: ReservationRequest): Promise<Reservation> {
    const failure = this.failures.find((f) => f.productId === request.productId)
    if (failure) throw new Error(`Reservation failed for ${request.productId}: ${failure.reason}`)

    const reservation: Reservation = {
      reservationId: `res_${request.checkoutId}_${request.productId}`,
      merchantId: request.merchantId,
      locationId: request.locationId,
      productId: request.productId,
      quantity: request.quantity,
      status: "reserved",
      expiresAt: request.expiresAt,
    }
    this.reservations.set(reservation.reservationId, reservation)
    return { ...reservation }
  }

  async release(reservationId: string, _reason: string): Promise<Reservation> {
    const reservation = this.reservations.get(reservationId)
    if (!reservation) throw new Error(`Unknown reservation: ${reservationId}`)
    const released = { ...reservation, status: "released" as const }
    this.reservations.set(reservationId, released)
    return { ...released }
  }

  async confirm(reservationId: string): Promise<Reservation> {
    const reservation = this.reservations.get(reservationId)
    if (!reservation) throw new Error(`Unknown reservation: ${reservationId}`)
    const confirmed = { ...reservation, status: "confirmed" as const }
    this.reservations.set(reservationId, confirmed)
    return { ...confirmed }
  }

  statusOf(reservationId: string): Reservation["status"] | undefined {
    return this.reservations.get(reservationId)?.status
  }
}

const TAX_RATE = 0.08
const DELIVERY_FEE_MINOR = 499
const PLATFORM_FEE_RATE = 0.05

/** Deterministic pricing: 8% tax, flat $4.99 delivery, 5% platform fee. No external rate lookup. */
export class DeterministicPricingService implements PricingService {
  async confirm(checkout: CheckoutSession, _reservations: Reservation[]): Promise<FinalPrice> {
    const subtotalMinor = checkout.items.reduce((sum, item) => sum + item.unitAmountMinor * item.quantity, 0)
    const taxMinor = Math.round(subtotalMinor * TAX_RATE)
    const platformFeeMinor = Math.round(subtotalMinor * PLATFORM_FEE_RATE)
    const deliveryFeeMinor = checkout.items.length > 0 ? DELIVERY_FEE_MINOR : 0
    return {
      subtotalMinor,
      taxMinor,
      deliveryFeeMinor,
      platformFeeMinor,
      totalMinor: subtotalMinor + taxMinor + deliveryFeeMinor + platformFeeMinor,
      currency: checkout.currency,
      policyVersion: "commerce-proof-pricing-v1",
    }
  }
}

// ---------------------------------------------------------------------
// payment-core reference provider
// ---------------------------------------------------------------------

export interface InMemoryPaymentProviderOptions {
  /** Amounts at or above this (in minor units) are declined — the only way this reference provider ever fails. */
  declineAtOrAboveMinor?: number
}

/**
 * In-memory PaymentProvider. Captures instantly (no separate authorize
 * step held open) and tracks every intent/refund it issues so tests can
 * inspect real resulting state, not just return values.
 */
export class InMemoryPaymentProvider implements PaymentProvider {
  readonly name = "in-memory-reference"
  private readonly intents = new Map<string, PaymentIntent>()
  private readonly declineAtOrAboveMinor: number

  constructor(options: InMemoryPaymentProviderOptions = {}) {
    this.declineAtOrAboveMinor = options.declineAtOrAboveMinor ?? Number.POSITIVE_INFINITY
  }

  async createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntent> {
    const now = new Date().toISOString()
    const declined = request.amount.amountMinor >= this.declineAtOrAboveMinor
    const intent: PaymentIntent = {
      paymentId: request.paymentId,
      provider: this.name,
      providerReference: `ref_${request.paymentId}`,
      orderId: request.orderId,
      amount: request.amount,
      status: declined ? "failed" : "captured",
      rail: "card",
      createdAt: now,
      updatedAt: now,
    }
    this.intents.set(intent.paymentId, intent)
    return { ...intent }
  }

  async capture(paymentId: string): Promise<PaymentIntent> {
    const intent = this.require(paymentId)
    if (intent.status !== "authorized") return { ...intent }
    const captured = { ...intent, status: "captured" as const, updatedAt: new Date().toISOString() }
    this.intents.set(paymentId, captured)
    return { ...captured }
  }

  async refund(request: RefundRequest): Promise<PaymentIntent> {
    const intent = this.require(request.paymentId)
    if (intent.status !== "captured" && intent.status !== "partially_refunded") {
      throw new Error(`Cannot refund a payment in status ${intent.status}`)
    }
    const refunded = { ...intent, status: "refunded" as const, updatedAt: new Date().toISOString() }
    this.intents.set(request.paymentId, refunded)
    return { ...refunded }
  }

  async getPayment(paymentId: string): Promise<PaymentIntent> {
    return { ...this.require(paymentId) }
  }

  async createPayout(): Promise<{ payoutId: string; providerReference?: string }> {
    throw new Error("Payouts are out of scope for this reference provider")
  }

  async reconcile(): Promise<never> {
    throw new Error("Reconciliation is out of scope for this reference provider")
  }

  private require(paymentId: string): PaymentIntent {
    const intent = this.intents.get(paymentId)
    if (!intent) throw new Error(`Unknown payment intent: ${paymentId}`)
    return intent
  }

  /** Test/inspection helper. */
  list(): PaymentIntent[] {
    return [...this.intents.values()]
  }
}

// ---------------------------------------------------------------------
// order-fulfillment-core adapters
// ---------------------------------------------------------------------

export class InMemoryMerchantOrderAdapter implements MerchantOrderAdapter {
  readonly calls: string[] = []

  async createOrder(): Promise<{ externalOrderId?: string }> {
    this.calls.push("createOrder")
    return {}
  }
  async acceptOrder(): Promise<void> {
    this.calls.push("acceptOrder")
  }
  async markPicking(): Promise<void> {
    this.calls.push("markPicking")
  }
  async markReady(): Promise<void> {
    this.calls.push("markReady")
  }
  async cancelOrder(): Promise<void> {
    this.calls.push("cancelOrder")
  }
}

export class InMemoryManifestAdapter implements ManifestAdapter {
  private readonly manifests = new Map<string, Manifest>()

  async create(input: { manifestId: string; orderId: string; merchantId: string; locationId: string; policyVersion: string }): Promise<Manifest> {
    const manifest: Manifest = {
      manifestId: input.manifestId,
      orderId: input.orderId,
      merchantId: input.merchantId,
      locationId: input.locationId,
      status: "created",
      policyVersion: input.policyVersion,
      createdAt: new Date().toISOString(),
    }
    this.manifests.set(manifest.manifestId, manifest)
    return { ...manifest }
  }

  async seal(manifestId: string): Promise<Manifest> {
    const manifest = this.require(manifestId)
    const sealed: Manifest = { ...manifest, status: "sealed", sealedAt: new Date().toISOString() }
    this.manifests.set(manifestId, sealed)
    return { ...sealed }
  }

  async assignCourier(manifestId: string, courierId: string): Promise<Manifest> {
    const manifest = this.require(manifestId)
    const assigned: Manifest = { ...manifest, courierId, status: "handoff_ready" }
    this.manifests.set(manifestId, assigned)
    return { ...assigned }
  }

  async handoff(manifestId: string, input: { courierId: string; verifiedAt: string }): Promise<Manifest> {
    const manifest = this.require(manifestId)
    const handed: Manifest = { ...manifest, courierId: input.courierId, status: "handed_over" }
    this.manifests.set(manifestId, handed)
    return { ...handed }
  }

  async void(manifestId: string, _reason: string): Promise<Manifest> {
    const manifest = this.require(manifestId)
    const voided: Manifest = { ...manifest, status: "voided" }
    this.manifests.set(manifestId, voided)
    return { ...voided }
  }

  private require(manifestId: string): Manifest {
    const manifest = this.manifests.get(manifestId)
    if (!manifest) throw new Error(`Unknown manifest: ${manifestId}`)
    return manifest
  }

  get(manifestId: string): Manifest | undefined {
    const manifest = this.manifests.get(manifestId)
    return manifest ? { ...manifest } : undefined
  }
}

export class InMemoryCustodyLedger implements CustodyLedger {
  private readonly events: CustodyEvent[] = []

  async append(event: CustodyEvent): Promise<void> {
    this.events.push({ ...event })
  }

  async list(orderId: string): Promise<CustodyEvent[]> {
    return this.events.filter((event) => event.orderId === orderId).map((event) => ({ ...event }))
  }

  /** Test/inspection helper — every event ever appended, across all orders. */
  all(): CustodyEvent[] {
    return [...this.events]
  }
}

export interface PolicyGateOptions {
  denyActions?: Array<"accept" | "pick" | "handoff" | "deliver" | "cancel">
}

/** Deterministic gate: allows everything except explicitly configured denied actions. */
export class ConfigurablePolicyGate implements PolicyGate {
  constructor(private readonly options: PolicyGateOptions = {}) {}

  async evaluate(input: { action: "accept" | "pick" | "handoff" | "deliver" | "cancel"; order: Order; policy: FulfillmentPolicy }) {
    if (this.options.denyActions?.includes(input.action)) {
      return { allowed: false, reason: `Policy denies action '${input.action}' under ${input.policy.policyVersion}` }
    }
    if (!input.policy.merchantMayFulfill && input.action === "accept") {
      return { allowed: false, reason: "Merchant is not authorized to fulfill under this policy" }
    }
    return { allowed: true }
  }
}

export const REFERENCE_FULFILLMENT_POLICY: FulfillmentPolicy = {
  jurisdictionId: "US",
  policyVersion: "commerce-proof-fulfillment-v1",
  merchantMayFulfill: true,
  courierHandoffAllowed: true,
  deliveryAllowed: true,
  requiredHandoffEvidence: ["photo"],
}

export function toFulfillmentItems(items: CheckoutItem[], reservations: Reservation[]): FulfillmentItem[] {
  return items.map((item, index) => {
    const reservation = reservations[index]
    if (!reservation || reservation.productId !== item.productId) {
      throw new Error(`No matching reservation for product ${item.productId}`)
    }
    return {
      orderItemId: `${item.offerId}:${index}`,
      productId: item.productId,
      quantity: item.quantity,
      merchantId: item.merchantId,
      locationId: item.locationId,
      reservationId: reservation.reservationId,
    }
  })
}

export type { Money }
