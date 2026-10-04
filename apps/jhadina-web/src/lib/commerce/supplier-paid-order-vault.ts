import "server-only"

import type {
  SuplifulShopifyPaidOrder,
  SuplifulShopifyPaidOrderResolver,
} from "@jhadina/commerce-adapters"
import { createServiceRoleClient } from "../supabase/service-role"

export interface SupplierPaidOrderRecordInput {
  userId: string
  internalOrderId: string
  internalOrderItemId: string
  customerEmail: string
  customerPhone?: string | null
  shippingAddress: SuplifulShopifyPaidOrder["shippingAddress"]
  paidAt: string
  paymentEvidenceRefs: string[]
}

type PaidOrderRow = {
  internal_order_id: string
  internal_order_item_id: string
  customer_email: string
  customer_phone: string | null
  shipping_address: SuplifulShopifyPaidOrder["shippingAddress"]
  paid_at: string
  payment_evidence_refs: string[]
}

export interface SupplierPaidOrderVault extends SuplifulShopifyPaidOrderResolver {
  recordPaidOrder(input: SupplierPaidOrderRecordInput): Promise<void>
}

export function createSupplierPaidOrderVault(): SupplierPaidOrderVault {
  return {
    async recordPaidOrder(input) {
      const client = createServiceRoleClient()
      if (!client) throw new Error("SUPPLIER_PAID_ORDER_VAULT_NOT_CONFIGURED")

      const userId = requireText(input.userId, "userId")
      const internalOrderId = requireText(input.internalOrderId, "internalOrderId")
      const internalOrderItemId = requireText(input.internalOrderItemId, "internalOrderItemId")
      const customerEmail = requireEmail(input.customerEmail)
      const shippingAddress = normalizeAddress(input.shippingAddress)
      const paidAt = normalizeTimestamp(input.paidAt, "paidAt")
      const evidenceRefs = uniqueEvidence(input.paymentEvidenceRefs)

      const { error } = await client
        .from("jhadina_supplier_paid_orders")
        .upsert({
          user_id: userId,
          internal_order_id: internalOrderId,
          internal_order_item_id: internalOrderItemId,
          payment_status: "paid",
          customer_email: customerEmail,
          customer_phone: input.customerPhone?.trim() || null,
          shipping_address: shippingAddress,
          paid_at: paidAt,
          payment_evidence_refs: evidenceRefs,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,internal_order_id,internal_order_item_id",
        })

      if (error) throw new Error(`SUPPLIER_PAID_ORDER_STORE_FAILED:${error.message}`)
    },

    async resolvePaidOrder(input) {
      const client = createServiceRoleClient()
      if (!client) throw new Error("SUPPLIER_PAID_ORDER_VAULT_NOT_CONFIGURED")

      const userId = requireText(input.actorId, "actorId")
      const internalOrderId = requireText(input.internalOrderId, "internalOrderId")
      const internalOrderItemId = requireText(input.internalOrderItemId, "internalOrderItemId")

      const { data, error } = await client
        .from("jhadina_supplier_paid_orders")
        .select(
          "internal_order_id,internal_order_item_id,customer_email,customer_phone,shipping_address,paid_at,payment_evidence_refs",
        )
        .eq("user_id", userId)
        .eq("internal_order_id", internalOrderId)
        .eq("internal_order_item_id", internalOrderItemId)
        .eq("payment_status", "paid")
        .maybeSingle<PaidOrderRow>()

      if (error) throw new Error(`SUPPLIER_PAID_ORDER_READ_FAILED:${error.message}`)
      if (!data) return null

      return {
        internalOrderId: data.internal_order_id,
        customerEmail: requireEmail(data.customer_email),
        customerPhone: data.customer_phone?.trim() || undefined,
        shippingAddress: normalizeAddress(data.shipping_address),
        paidAt: normalizeTimestamp(data.paid_at, "paidAt"),
        paymentEvidenceRefs: uniqueEvidence(data.payment_evidence_refs),
      }
    },
  }
}

function normalizeAddress(
  address: SuplifulShopifyPaidOrder["shippingAddress"],
): SuplifulShopifyPaidOrder["shippingAddress"] {
  if (!address || typeof address !== "object") throw new Error("shippingAddress is required")
  const countryCode = requireText(address.countryCode, "shippingAddress.countryCode").toUpperCase()
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error("shippingAddress.countryCode must be a 2-letter country code")
  }
  return {
    firstName: address.firstName?.trim() || undefined,
    lastName: address.lastName?.trim() || undefined,
    name: address.name?.trim() || undefined,
    address1: requireText(address.address1, "shippingAddress.address1"),
    address2: address.address2?.trim() || undefined,
    city: requireText(address.city, "shippingAddress.city"),
    provinceCode: address.provinceCode?.trim() || undefined,
    countryCode,
    zip: requireText(address.zip, "shippingAddress.zip"),
    phone: address.phone?.trim() || undefined,
  }
}

function requireEmail(value: string): string {
  const email = requireText(value, "customerEmail").toLowerCase()
  if (!/^[^@s]+@[^@s]+.[^@s]+$/.test(email)) throw new Error("customerEmail is invalid")
  return email
}

function normalizeTimestamp(value: string, field: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be a valid timestamp`)
  return new Date(parsed).toISOString()
}

function uniqueEvidence(values: readonly string[]): string[] {
  const refs = [...new Set(values.map((value) => value.trim()).filter(Boolean))]
  if (!refs.length) throw new Error("paymentEvidenceRefs are required")
  return refs
}

function requireText(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`)
  return value.trim()
}
