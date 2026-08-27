import { describe, it, expect } from "vitest"
import {
  getCommerceCapability,
  isCommerceCapability,
  isCommerceCapabilityImplemented,
  listCommerceCapabilities,
} from "./commerce-capability-registry"
import {
  COMMERCE_CHECKOUT_CAPABILITY,
  COMMERCE_PAYMENT_CHARGE_CAPABILITY,
  COMMERCE_PAYMENT_REFUND_CAPABILITY,
  COMMERCE_SECURITY_POLICY,
} from "./commerce-security-policy"

describe("Commerce capability registry — describes, never authorizes", () => {
  it("lists exactly the capabilities that exist in code today", () => {
    expect([...listCommerceCapabilities()].sort()).toEqual(
      [
        COMMERCE_CHECKOUT_CAPABILITY,
        COMMERCE_PAYMENT_CHARGE_CAPABILITY,
        COMMERCE_PAYMENT_REFUND_CAPABILITY,
        "commerce.payment.payout",
        "commerce.payment.reconcile",
      ].sort(),
    )
  })

  it("marks commerce.payment.charge and commerce.payment.refund as implemented and approval-gated", () => {
    expect(isCommerceCapabilityImplemented(COMMERCE_PAYMENT_CHARGE_CAPABILITY)).toBe(true)
    expect(getCommerceCapability(COMMERCE_PAYMENT_CHARGE_CAPABILITY).requiresApproval).toBe(true)
    expect(isCommerceCapabilityImplemented(COMMERCE_PAYMENT_REFUND_CAPABILITY)).toBe(true)
    expect(getCommerceCapability(COMMERCE_PAYMENT_REFUND_CAPABILITY).requiresApproval).toBe(true)
  })

  it("marks payout and reconcile as named but not implemented", () => {
    expect(isCommerceCapabilityImplemented("commerce.payment.payout")).toBe(false)
    expect(isCommerceCapabilityImplemented("commerce.payment.reconcile")).toBe(false)
  })

  it("marks commerce.checkout as implemented and not approval-gated", () => {
    expect(isCommerceCapabilityImplemented(COMMERCE_CHECKOUT_CAPABILITY)).toBe(true)
    expect(getCommerceCapability(COMMERCE_CHECKOUT_CAPABILITY).requiresApproval).toBe(false)
  })

  it("rejects an unknown capability string", () => {
    expect(isCommerceCapability("commerce.something.imaginary")).toBe(false)
  })

  it("agrees with COMMERCE_SECURITY_POLICY on which implemented capabilities require approval", () => {
    for (const capability of listCommerceCapabilities()) {
      const definition = getCommerceCapability(capability)
      if (definition.status !== "implemented") continue
      const policyRequiresApproval = COMMERCE_SECURITY_POLICY.approvalCapabilities.includes(capability)
      expect(definition.requiresApproval).toBe(policyRequiresApproval)
    }
  })
})
