import { describe,expect,it } from "vitest"
import { auditExecutionState,connectorExecutionState,executionStateLabel } from "./execution-ux"

describe("Jhadina execution UX",()=>{
 it("never presents approval-required as approved",()=>{
  expect(auditExecutionState("approval_required")).toBe("needs_approval")
  expect(executionStateLabel("needs_approval")).toBe("Needs approval")
 })
 it("presents confirmed-not-executed reconciliation as retry safe, not approved",()=>{
  const state=connectorExecutionState({state:"recovery_required",reconciliation:{status:"confirmed_not_executed",observedState:"NOT_FOUND"}})
  expect(state).toBe("retry_safe")
  expect(executionStateLabel(state)).toContain("fresh authorization required")
 })
 it("marks a successful recovery child as recovered",()=>{
  expect(connectorExecutionState({state:"completed",recoveryOfExecutionId:"parent"})).toBe("recovered")
 })
 it("keeps unknown reconciliation in recovery-required state",()=>{
  expect(connectorExecutionState({state:"recovery_required",reconciliation:{status:"unknown",observedState:"PENDING"}})).toBe("recovery_required")
 })
})
