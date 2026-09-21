import { describe, expect, it } from "vitest"
import {
  parcelLabelIdempotencyKey,
  type ParcelRateRequest,
} from "@jhadina/order-fulfillment-core"
import {
  ShipEngineParcelShippingAdapter,
  type ShipEngineClient,
  type ShipEngineLabelResponse,
} from "./shipengine-parcel-shipping"

function rateRequest(): ParcelRateRequest {
  return {
    orderId: "order-1",
    shipmentId: "shipment-1",
    shipFrom: {
      name: "Warehouse",
      addressLine1: "1 Warehouse Way",
      city: "Austin",
      stateProvince: "TX",
      postalCode: "78701",
      countryCode: "US",
    },
    shipTo: {
      name: "Customer",
      addressLine1: "1 Customer Way",
      city: "Riverside",
      stateProvince: "CA",
      postalCode: "92501",
      countryCode: "US",
      residential: true,
    },
    packages: [{
      weight: { value: 20, unit: "ounce" },
      dimensions: { length: 12, width: 8, height: 4, unit: "inch" },
    }],
    carrierIds: ["se-carrier-1"],
  }
}

function label(): ShipEngineLabelResponse {
  return {
    label_id: "se-label-1",
    shipment_id: "se-shipment-1",
    status: "completed",
    shipment_cost: { amount: 7.25, currency: "usd" },
    insurance_cost: { amount: 0, currency: "usd" },
    tracking_number: "TRACK123",
    carrier_id: "se-carrier-1",
    carrier_code: "ups",
    service_code: "ups_ground",
    label_format: "pdf",
    label_download: { pdf: "https://example.invalid/label.pdf" },
    created_at: "2026-09-21T12:00:00Z",
  }
}

describe("ShipEngine parcel adapter", () => {
  it("normalizes rate reads without purchasing anything", async () => {
    let purchaseCalls = 0
    const client: ShipEngineClient = {
      async getRates() {
        return [{
          rate_id: "rate-1",
          carrier_id: "se-carrier-1",
          carrier_code: "ups",
          service_code: "ups_ground",
          service_type: "UPS Ground",
          shipping_amount: { amount: 7.25, currency: "usd" },
          delivery_days: 4,
          estimated_delivery_date: "2026-09-25T12:00:00Z",
        }]
      },
      async findLabelByIdempotencyKey() { return null },
      async createLabelFromRate() { purchaseCalls += 1; return label() },
      async voidLabel() { return { approved: true, message: "voided" } },
      async getTracking() { return { tracking_number: "TRACK123", status_code: "in_transit" } },
    }

    const adapter = new ShipEngineParcelShippingAdapter(client)
    const rates = await adapter.getRates(rateRequest())
    expect(rates).toHaveLength(1)
    expect(rates[0]).toMatchObject({
      rateId: "rate-1",
      amountMinor: 725,
      currency: "USD",
      deliveryDays: 4,
    })
    expect(purchaseCalls).toBe(0)
  })

  it("uses idempotency lookup before purchasing a real-money label", async () => {
    const key = parcelLabelIdempotencyKey("order-1", "shipment-1")
    let createCalls = 0
    let persisted: ShipEngineLabelResponse | null = null
    const client: ShipEngineClient = {
      async getRates() { return [] },
      async findLabelByIdempotencyKey() { return persisted },
      async createLabelFromRate() {
        createCalls += 1
        persisted = label()
        return persisted
      },
      async voidLabel() { return { approved: true, message: "voided" } },
      async getTracking() { return { tracking_number: "TRACK123", status_code: "in_transit" } },
    }
    const adapter = new ShipEngineParcelShippingAdapter(client)
    const request = {
      orderId: "order-1",
      shipmentId: "shipment-1",
      rateId: "rate-1",
      idempotencyKey: key,
      labelFormat: "pdf" as const,
    }

    const first = await adapter.purchaseLabel(request)
    const second = await adapter.purchaseLabel(request)
    expect(first.labelId).toBe("se-label-1")
    expect(second.labelId).toBe("se-label-1")
    expect(first.amountMinor).toBe(725)
    expect(createCalls).toBe(1)
  })

  it("normalizes voids and tracking webhooks", async () => {
    const client: ShipEngineClient = {
      async getRates() { return [] },
      async findLabelByIdempotencyKey() { return null },
      async createLabelFromRate() { return label() },
      async voidLabel() { return { approved: true, message: "refund submitted" } },
      async getTracking() {
        return {
          tracking_number: "TRACK123",
          carrier_code: "ups",
          status_code: "delivered",
          actual_delivery_date: "2026-09-25T12:00:00Z",
        }
      },
    }
    const adapter = new ShipEngineParcelShippingAdapter(client)
    const voided = await adapter.voidLabel("se-label-1", "void:se-label-1")
    expect(voided.status).toBe("voided")

    const tracking = await adapter.getTracking("TRACK123", "ups")
    expect(tracking.status).toBe("delivered")

    const webhook = adapter.normalizeTrackingWebhook({
      event_id: "event-1",
      occurred_at: "2026-09-25T12:00:00Z",
      data: {
        tracking_number: "TRACK123",
        carrier_code: "ups",
        status_code: "out_for_delivery",
        events: [{
          status_code: "in_transit",
          description: "Departed facility",
          occurred_at: "2026-09-24T12:00:00Z",
          city_locality: "Riverside",
          state_province: "CA",
          country_code: "US",
        }],
      },
    })
    expect(webhook.eventId).toBe("event-1")
    expect(webhook.snapshot.status).toBe("out_for_delivery")
    expect(webhook.snapshot.events[0].location).toBe("Riverside, CA, US")
  })
})
