import { test } from "node:test"
import assert from "node:assert/strict"
import { JhadinaSecurityCore, createSecurityRequest, JHADINA_BASE_SECURITY_POLICY } from "@jhadina/security-core"
import {
  EVOLUTION_MERGE_CAPABILITY,
  EVOLUTION_PROPOSE_CAPABILITY,
  EVOLUTION_SECURITY_POLICY,
} from "./evolution-security-policy"

test("EVOLUTION_SECURITY_POLICY is additive: every base-policy capability is preserved", () => {
  for (const capability of JHADINA_BASE_SECURITY_POLICY.allowedCapabilities) {
    assert.ok(EVOLUTION_SECURITY_POLICY.allowedCapabilities.includes(capability))
  }
})

test("evolution.propose and evolution.merge are both allow-listed and approval-gated", () => {
  assert.ok(EVOLUTION_SECURITY_POLICY.allowedCapabilities.includes(EVOLUTION_PROPOSE_CAPABILITY))
  assert.ok(EVOLUTION_SECURITY_POLICY.allowedCapabilities.includes(EVOLUTION_MERGE_CAPABILITY))
  assert.ok(EVOLUTION_SECURITY_POLICY.approvalCapabilities.includes(EVOLUTION_PROPOSE_CAPABILITY))
  assert.ok(EVOLUTION_SECURITY_POLICY.approvalCapabilities.includes(EVOLUTION_MERGE_CAPABILITY))
})

test("policy.self_modify is never added to EVOLUTION_SECURITY_POLICY — out of scope for Step 9 by design", () => {
  assert.equal(EVOLUTION_SECURITY_POLICY.allowedCapabilities.includes("policy.self_modify"), false)
})

test("the base SecurityCore layer, in isolation, now reaches approval_required (not stuck at deny) for both capabilities", async () => {
  const security = new JhadinaSecurityCore(EVOLUTION_SECURITY_POLICY)

  const proposeRequest = createSecurityRequest({
    requestId: "req-1", actorId: "user-1", domain: "evolution", capability: EVOLUTION_PROPOSE_CAPABILITY,
  })
  assert.equal(security.authorize(proposeRequest), "approval_required")

  const mergeRequest = createSecurityRequest({
    requestId: "req-2", actorId: "user-1", domain: "evolution", capability: EVOLUTION_MERGE_CAPABILITY,
  })
  assert.equal(security.authorize(mergeRequest), "approval_required")
})

test("before this milestone, the same two capabilities were unconditionally denied by the unmodified base policy (regression guard for the audited gap)", async () => {
  const security = new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY)

  const proposeRequest = createSecurityRequest({
    requestId: "req-3", actorId: "user-1", domain: "evolution", capability: EVOLUTION_PROPOSE_CAPABILITY,
  })
  assert.equal(security.authorize(proposeRequest), "deny")

  const mergeRequest = createSecurityRequest({
    requestId: "req-4", actorId: "user-1", domain: "evolution", capability: EVOLUTION_MERGE_CAPABILITY,
  })
  assert.equal(security.authorize(mergeRequest), "deny")
})
