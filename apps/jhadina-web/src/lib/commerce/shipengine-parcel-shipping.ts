import {
  assertParcelLabelPurchaseRequest,
  assertParcelRateRequest,
  type ParcelLabel,
  type ParcelLabelFormat,
  type ParcelLabelPurchaseRequest,
  type ParcelLabelVoidResult,
  type ParcelRateQuote,
  type ParcelRateRequest,
  type ParcelShippingAdapter,
  type ParcelTrackingSnapshot,
  type ParcelTrackingStatus,
  type ParcelTrackingWebhook,
  type ParcelWebhookVerification,
} from "@jhadina/order-fulfillment-core"

export interface ShipEngineMoney {
  currency: string
  amount: number
}

export interface ShipEngineRate {
  rate_id: string
  carrier_id: string
  carrier_code?: string
  service_code: string
  service_type?: string
  shipping_amount: ShipEngineMoney
  delivery_days?: number
  estimated_delivery_date?: string
}

export interface ShipEngineLabelResponse {
  label_id: string
  shipment_id: string
  status: "processing" | "completed" | "error" | "voided"
  shipment_cost: ShipEngineMoney
  insurance_cost?: ShipEngineMoney
  tracking_number?: string
  carrier_id: string
  carrier_code?: string
  service_code: string
  label_format: string
  label_download?: {
    pdf?: string
    png?: string
    zpl?: string
    href?: string
  }
  created_at: string
  voided_at?: string | null
}

export interface ShipEngineTrackingEvent {
  status_code?: string
  description?: string
  occurred_at: string
  city_locality?: string
  state_province?: string
  country_code?: string
}

export interface ShipEngineTrackingResponse {
  tracking_number: string
  carrier_code?: string
  status_code?: string
  estimated_delivery_date?: string
  actual_delivery_date?: string
  events?: ShipEngineTrackingEvent[]
}

export interface ShipEngineTrackingWebhookPayload {
  event_id?: string
  resource_type?: string
  data: ShipEngineTrackingResponse
  occurred_at?: string
}

export interface ShipEngineClient {
  getRates(request: ParcelRateRequest): Promise<ShipEngineRate[]>
  findLabelByIdempotencyKey(idempotencyKey: string): Promise<ShipEngineLabelResponse | null>
  createLabelFromRate(input: {
    rateId: string
    labelFormat: ParcelLabelFormat
    idempotencyKey: string
  }): Promise<ShipEngineLabelResponse>
  voidLabel(labelId: string): Promise<{ approved: boolean; message?: string }>
  getTracking(trackingNumber: string, carrierCode?: string): Promise<ShipEngineTrackingResponse>
}

/**
 * Provider adapter over an injected ShipEngine/ShipStation API client.
 *
 * The client contract intentionally requires lookup by Jhadina idempotency
 * key before label purchase. A live transport must prove how it persists or
 * resolves that mapping before it can be certified for real-money labels.
 */
export class ShipEngineParcelShippingAdapter implements ParcelShippingAdapter {
  readonly provider = "shipengine"

  constructor(private readonly client: ShipEngineClient) {}

  async getRates(request: ParcelRateRequest): Promise<ParcelRateQuote[]> {
    assertParcelRateRequest(request)
    const rows = await this.client.getRates(request)
    const observedAt = new Date().toISOString()
    return rows.flatMap((row): ParcelRateQuote[] => {
      const amountMinor = moneyToMinor(row.shipping_amount)
      if (
        !row.rate_id?.trim() ||
        !row.carrier_id?.trim() ||
        !row.service_code?.trim() ||
        amountMinor === undefined
      ) {
        return []
      }
      return [{
        rateId: row.rate_id,
        carrierId: row.carrier_id,
        carrierCode: row.carrier_code,
        serviceCode: row.service_code,
        serviceName: row.service_type,
        amountMinor,
        currency: row.shipping_amount.currency.trim().toUpperCase(),
        deliveryDays:
          Number.isFinite(row.delivery_days) && (row.delivery_days ?? -1) >= 0
            ? Math.floor(row.delivery_days!)
            : undefined,
        estimatedDeliveryAt: normalizeOptionalTimestamp(row.estimated_delivery_date),
        observedAt,
      }]
    })
  }

  async purchaseLabel(request: ParcelLabelPurchaseRequest): Promise<ParcelLabel> {
    assertParcelLabelPurchaseRequest(request)
    const existing = await this.client.findLabelByIdempotencyKey(request.idempotencyKey)
    if (existing) return normalizeLabel(existing, request)

    const created = await this.client.createLabelFromRate({
      rateId: request.rateId,
      labelFormat: request.labelFormat,
      idempotencyKey: request.idempotencyKey,
    })
    return normalizeLabel(created, request)
  }

  async voidLabel(labelId: string, idempotencyKey: string): Promise<ParcelLabelVoidResult> {
    if (!labelId.trim()) throw new Error("labelId is required")
    if (!idempotencyKey.trim()) throw new Error("idempotencyKey is required")
    const response = await this.client.voidLabel(labelId)
    return response.approved
      ? { labelId, status: "voided", voidedAt: new Date().toISOString(), reason: response.message }
      : { labelId, status: "rejected", reason: response.message }
  }

  async getTracking(trackingNumber: string, carrierCode?: string): Promise<ParcelTrackingSnapshot> {
    if (!trackingNumber.trim()) throw new Error("trackingNumber is required")
    return normalizeTracking(await this.client.getTracking(trackingNumber, carrierCode))
  }

  normalizeTrackingWebhook(
    payload: unknown,
    verification: ParcelWebhookVerification,
  ): ParcelTrackingWebhook {
    if (
      !verification.verified ||
      verification.provider !== this.provider ||
      !Number.isFinite(Date.parse(verification.verifiedAt))
    ) {
      throw new Error("ShipEngine tracking webhook must be signature-verified before normalization")
    }
    if (!payload || typeof payload !== "object" || !("data" in payload)) {
      throw new Error("Invalid ShipEngine tracking webhook")
    }
    const body = payload as ShipEngineTrackingWebhookPayload
    const snapshot = normalizeTracking(body.data)
    return {
      provider: this.provider,
      eventId: body.event_id?.trim() || `shipengine:tracking:${snapshot.trackingNumber}:${snapshot.observedAt}`,
      trackingNumber: snapshot.trackingNumber,
      carrierCode: snapshot.carrierCode,
      snapshot,
      occurredAt: normalizeOptionalTimestamp(body.occurred_at) ?? snapshot.observedAt,
    }
  }
}

function normalizeLabel(
  row: ShipEngineLabelResponse,
  request: ParcelLabelPurchaseRequest,
): ParcelLabel {
  const amountMinor = moneyToMinor(row.shipment_cost)
  if (amountMinor === undefined) throw new Error("ShipEngine label cost is invalid")
  const insuranceAmountMinor = row.insurance_cost ? moneyToMinor(row.insurance_cost) : undefined
  if (row.insurance_cost && insuranceAmountMinor === undefined) {
    throw new Error("ShipEngine insurance cost is invalid")
  }
  const format = normalizeLabelFormat(row.label_format, request.labelFormat)
  return {
    labelId: row.label_id,
    shipmentId: request.shipmentId,
    orderId: request.orderId,
    carrierId: row.carrier_id,
    carrierCode: row.carrier_code,
    serviceCode: row.service_code,
    trackingNumber: row.tracking_number,
    amountMinor,
    insuranceAmountMinor,
    currency: row.shipment_cost.currency.trim().toUpperCase(),
    labelFormat: format,
    downloadUrl: row.label_download?.[format] ?? row.label_download?.href,
    status: row.status,
    createdAt: normalizeRequiredTimestamp(row.created_at, "ShipEngine label created_at"),
    voidedAt: normalizeOptionalTimestamp(row.voided_at ?? undefined),
    idempotencyKey: request.idempotencyKey,
  }
}

function normalizeTracking(row: ShipEngineTrackingResponse): ParcelTrackingSnapshot {
  if (!row.tracking_number?.trim()) throw new Error("ShipEngine tracking number is required")
  const observedAt = new Date().toISOString()
  const events = (row.events ?? []).flatMap((event) => {
    const occurredAt = normalizeOptionalTimestamp(event.occurred_at)
    if (!occurredAt) return []
    const location = [event.city_locality, event.state_province, event.country_code]
      .filter(Boolean)
      .join(", ")
    return [{
      status: normalizeTrackingStatus(event.status_code),
      description: event.description,
      occurredAt,
      location: location || undefined,
    }]
  })
  return {
    trackingNumber: row.tracking_number,
    carrierCode: row.carrier_code,
    status: normalizeTrackingStatus(row.status_code),
    estimatedDeliveryAt: normalizeOptionalTimestamp(row.estimated_delivery_date),
    deliveredAt: normalizeOptionalTimestamp(row.actual_delivery_date),
    events,
    observedAt,
  }
}

function normalizeTrackingStatus(value?: string): ParcelTrackingStatus {
  switch ((value ?? "").toLowerCase()) {
    case "ac":
    case "ny":
    case "pre_transit":
    case "label_created":
    case "accepted":
      return "pre_transit"
    case "it":
    case "in_transit":
    case "transit":
      return "in_transit"
    case "out_for_delivery":
      return "out_for_delivery"
    case "sp":
      return "available_for_pickup"
    case "de":
    case "delivered":
      return "delivered"
    case "ex":
    case "at":
    case "exception":
    case "delivery_exception":
      return "exception"
    case "cancelled":
    case "canceled":
      return "cancelled"
    default:
      return "unknown"
  }
}

function moneyToMinor(value: ShipEngineMoney): number | undefined {
  if (!value || !value.currency?.trim() || !Number.isFinite(value.amount) || value.amount < 0) {
    return undefined
  }
  return Math.round((value.amount + Number.EPSILON) * 100)
}

function normalizeLabelFormat(value: string, fallback: ParcelLabelFormat): ParcelLabelFormat {
  const normalized = value.trim().toLowerCase()
  return normalized === "pdf" || normalized === "png" || normalized === "zpl"
    ? normalized
    : fallback
}

function normalizeRequiredTimestamp(value: string, field: string): string {
  const normalized = normalizeOptionalTimestamp(value)
  if (!normalized) throw new Error(`${field} is invalid`)
  return normalized
}

function normalizeOptionalTimestamp(value?: string): string | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return undefined
  return new Date(parsed).toISOString()
}
