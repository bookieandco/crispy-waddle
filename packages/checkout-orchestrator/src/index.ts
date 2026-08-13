export type CheckoutStatus =
  | "created"
  | "reserving"
  | "reserved"
  | "pricing_confirmed"
  | "payment_pending"
  | "paid"
  | "order_created"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled";

export interface CheckoutItem {
  offerId: string;
  merchantId: string;
  locationId: string;
  productId: string;
  quantity: number;
  unitAmountMinor: number;
  currency: string;
}

export interface CheckoutSession {
  checkoutId: string;
  customerId: string;
  idempotencyKey: string;
  status: CheckoutStatus;
  items: CheckoutItem[];
  subtotalMinor: number;
  taxMinor: number;
  deliveryFeeMinor: number;
  platformFeeMinor: number;
  totalMinor: number;
  currency: string;
  reservationIds: string[];
  paymentId?: string;
  orderId?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationRequest {
  checkoutId: string;
  idempotencyKey: string;
  merchantId: string;
  locationId: string;
  productId: string;
  quantity: number;
  expiresAt: string;
}

export interface Reservation {
  reservationId: string;
  merchantId: string;
  locationId: string;
  productId: string;
  quantity: number;
  status: "reserved" | "released" | "expired" | "confirmed";
  expiresAt: string;
  providerReference?: string;
}

export interface InventoryReservationAdapter {
  reserve(request: ReservationRequest): Promise<Reservation>;
  release(reservationId: string, reason: string): Promise<Reservation>;
  confirm(reservationId: string): Promise<Reservation>;
}

export interface FinalPrice {
  subtotalMinor: number;
  taxMinor: number;
  deliveryFeeMinor: number;
  platformFeeMinor: number;
  totalMinor: number;
  currency: string;
  policyVersion: string;
}

export interface PricingService {
  confirm(checkout: CheckoutSession, reservations: Reservation[]): Promise<FinalPrice>;
}

export interface PaymentGateway {
  authorizeOrCapture(input: {
    paymentId: string;
    checkoutId: string;
    customerId: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<{ paymentId: string; status: "authorized" | "captured" | "failed"; providerReference?: string }>;
  refund(input: { paymentId: string; reason: string }): Promise<void>;
}

export interface OrderGateway {
  createOrder(input: {
    checkoutId: string;
    customerId: string;
    items: CheckoutItem[];
    reservations: Reservation[];
    paymentId: string;
    finalPrice: FinalPrice;
    idempotencyKey: string;
  }): Promise<{ orderId: string }>;
}

export interface CheckoutStore {
  get(checkoutId: string): Promise<CheckoutSession | null>;
  save(session: CheckoutSession): Promise<void>;
}

export interface CheckoutOrchestratorDeps {
  store: CheckoutStore;
  inventory: InventoryReservationAdapter;
  pricing: PricingService;
  payments: PaymentGateway;
  orders: OrderGateway;
  now?: () => Date;
}

export class CheckoutOrchestrator {
  constructor(private readonly deps: CheckoutOrchestratorDeps) {}

  async execute(checkoutId: string): Promise<CheckoutSession> {
    const session = await this.deps.store.get(checkoutId);
    if (!session) throw new Error("Checkout session not found");
    if (["completed", "cancelled", "expired"].includes(session.status)) return session;

    const now = (this.deps.now ?? (() => new Date()))();
    if (new Date(session.expiresAt) <= now) {
      await this.releaseReservations(session, "checkout_expired");
      session.status = "expired";
      session.updatedAt = now.toISOString();
      await this.deps.store.save(session);
      return session;
    }

    session.status = "reserving";
    session.updatedAt = now.toISOString();
    await this.deps.store.save(session);

    const reservations: Reservation[] = [];
    try {
      for (const item of session.items) {
        const reservation = await this.deps.inventory.reserve({
          checkoutId: session.checkoutId,
          idempotencyKey: `${session.idempotencyKey}:${item.offerId}`,
          merchantId: item.merchantId,
          locationId: item.locationId,
          productId: item.productId,
          quantity: item.quantity,
          expiresAt: session.expiresAt,
        });
        reservations.push(reservation);
        session.reservationIds.push(reservation.reservationId);
      }

      session.status = "reserved";
      await this.deps.store.save(session);

      const finalPrice = await this.deps.pricing.confirm(session, reservations);
      if (finalPrice.totalMinor < 0) throw new Error("Invalid final checkout total");

      session.subtotalMinor = finalPrice.subtotalMinor;
      session.taxMinor = finalPrice.taxMinor;
      session.deliveryFeeMinor = finalPrice.deliveryFeeMinor;
      session.platformFeeMinor = finalPrice.platformFeeMinor;
      session.totalMinor = finalPrice.totalMinor;
      session.currency = finalPrice.currency;
      session.status = "pricing_confirmed";
      await this.deps.store.save(session);

      session.status = "payment_pending";
      await this.deps.store.save(session);

      const payment = await this.deps.payments.authorizeOrCapture({
        paymentId: session.paymentId ?? `pay_${session.checkoutId}`,
        checkoutId: session.checkoutId,
        customerId: session.customerId,
        amountMinor: finalPrice.totalMinor,
        currency: finalPrice.currency,
        idempotencyKey: `${session.idempotencyKey}:payment`,
      });

      if (payment.status === "failed") throw new Error("Payment failed");
      session.paymentId = payment.paymentId;
      session.status = "paid";
      await this.deps.store.save(session);

      const order = await this.deps.orders.createOrder({
        checkoutId: session.checkoutId,
        customerId: session.customerId,
        items: session.items,
        reservations,
        paymentId: payment.paymentId,
        finalPrice,
        idempotencyKey: `${session.idempotencyKey}:order`,
      });

      session.orderId = order.orderId;
      session.status = "order_created";
      await this.deps.store.save(session);

      for (const reservation of reservations) {
        await this.deps.inventory.confirm(reservation.reservationId);
      }

      session.status = "completed";
      session.updatedAt = (this.deps.now ?? (() => new Date()))().toISOString();
      await this.deps.store.save(session);
      return session;
    } catch (error) {
      await this.releaseReservations(session, "checkout_failed");
      if (session.paymentId) {
        try {
          await this.deps.payments.refund({ paymentId: session.paymentId, reason: "checkout_failed" });
        } catch {
          // Reconciliation must resolve a refund failure; do not hide the original checkout failure.
        }
      }
      session.status = "failed";
      session.updatedAt = (this.deps.now ?? (() => new Date()))().toISOString();
      await this.deps.store.save(session);
      throw error;
    }
  }

  private async releaseReservations(session: CheckoutSession, reason: string): Promise<void> {
    for (const reservationId of session.reservationIds) {
      try {
        await this.deps.inventory.release(reservationId, reason);
      } catch {
        // A durable reconciliation/outbox process should retry this release.
      }
    }
  }
}

export const CHECKOUT_ORCHESTRATOR_VERSION = "0.1.0" as const;
