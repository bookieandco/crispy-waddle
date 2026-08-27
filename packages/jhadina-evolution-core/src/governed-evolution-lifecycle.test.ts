import { test, mock } from "node:test"
import assert from "node:assert/strict"
import {
  ActionExecutor,
  InMemoryActionLedger,
  InMemoryApprovalReceiptStore,
  JhadinaValuesActionPolicy,
  StaticIdentityVerifier,
  createApprovalRequestService,
  createApprovalReceiptVerifier,
  type ActionIdentityVerifier,
} from "@jhadina/action-core"
import { JHADINA_DEFAULT_VALUES_CONFIGURATION, type JhadinaValuesConfiguration } from "@jhadina/security-core"
import type { EvidenceRef, EvolutionPort, ImprovementEvaluation, ImprovementInput, ImprovementProposal } from "@jhadina/core-spine"
import {
  createEvolutionMergeHandler,
  createEvolutionProposeHandler,
  mergeEvolutionGoverned,
  proposeEvolutionGoverned,
  type EvolutionMergeAction,
  type EvolutionProposeAction,
  type GovernedEvolutionDeps,
} from "./governed-evolution-lifecycle"
import { EVOLUTION_MERGE_CAPABILITY, EVOLUTION_PROPOSE_CAPABILITY, EVOLUTION_SECURITY_POLICY } from "./evolution-security-policy"

/**
 * Step 9: comprehensive authorization/receipt/replay coverage, proven
 * entirely against a fake EvolutionPort (see governed-evolution-lifecycle.ts's
 * own header — no real EvolutionAnalyzer/EvolutionEvaluator/
 * GovernedRepairExecutor implementation exists anywhere in this repo
 * yet, so nothing here can perform a real repository mutation even by
 * accident).
 */

const USER_ID = "user-1"
const OTHER_USER_ID = "user-2"

function evidence(): EvidenceRef {
  return { id: "evidence-1", source: "repository", observedAt: "2026-01-01T00:00:00.000Z", summary: "test evidence" }
}

function input(overrides: Partial<ImprovementInput> = {}): ImprovementInput {
  return {
    id: "input-1",
    source: "repository",
    content: "refactor the flaky retry loop",
    receivedAt: "2026-01-01T00:00:00.000Z",
    evidence: [evidence()],
    ...overrides,
  }
}

function proposal(overrides: Partial<ImprovementProposal> = {}): ImprovementProposal {
  return {
    id: "proposal-1",
    inputId: "input-1",
    kind: "capability",
    title: "Fix flaky retry loop",
    problem: "Retries sometimes double-fire",
    proposedChange: "Add idempotency key",
    rationale: "Prevents duplicate side effects",
    expectedBenefit: "Fewer duplicate charges",
    risks: ["scope creep"],
    dependencies: [],
    affectedDomains: ["commerce"],
    evidence: [evidence()],
    confidence: 0.8,
    reversible: true,
    requiresApproval: true,
    status: "proposed",
    ...overrides,
  }
}

function evaluation(overrides: Partial<ImprovementEvaluation> = {}): ImprovementEvaluation {
  return {
    id: "evaluation-1",
    proposalId: "proposal-1",
    tests: [{ name: "unit", passed: true }],
    regressions: [],
    recommendation: "promote",
    evaluatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

class FakeEvolutionPort implements EvolutionPort {
  analyzeCalls = 0
  promoteCalls: Array<{ proposal: ImprovementProposal; evaluation: ImprovementEvaluation }> = []

  async analyze(_i: ImprovementInput): Promise<ImprovementProposal> {
    this.analyzeCalls += 1
    return proposal()
  }

  async evaluate(p: ImprovementProposal): Promise<ImprovementEvaluation> {
    return evaluation({ proposalId: p.id })
  }

  async promote(p: ImprovementProposal, e: ImprovementEvaluation): Promise<void> {
    this.promoteCalls.push({ proposal: p, evaluation: e })
  }
}

function identityVerifier(userId: string = USER_ID): ActionIdentityVerifier {
  return new StaticIdentityVerifier({ userId, sessionId: "session-1" })
}

function values(overrides: Partial<JhadinaValuesConfiguration> = {}): JhadinaValuesConfiguration {
  return {
    ...JHADINA_DEFAULT_VALUES_CONFIGURATION,
    updatedBy: "real_human_operator",
    ...overrides,
    selfModification: { ...JHADINA_DEFAULT_VALUES_CONFIGURATION.selfModification, ...overrides.selfModification },
  }
}

function baseDeps(overrides: Partial<GovernedEvolutionDeps> = {}): GovernedEvolutionDeps & { port: FakeEvolutionPort } {
  const port = new FakeEvolutionPort()
  return {
    identityVerifier: identityVerifier(),
    ledger: new InMemoryActionLedger(),
    approvalStore: new InMemoryApprovalReceiptStore(),
    evolutionPort: port,
    values: values(),
    port,
    ...overrides,
  }
}

// -- Full lifecycle -----------------------------------------------------

test("propose -> merge succeeds end to end and never calls the port before its own receipt is consumed", async () => {
  const deps = baseDeps()

  const proposed = await proposeEvolutionGoverned(deps, USER_ID, input())
  assert.equal(deps.port.analyzeCalls, 1)
  assert.equal(proposed.verifiedUserId, USER_ID)
  assert.ok(proposed.approvalReceiptId)

  const merged = await mergeEvolutionGoverned(deps, USER_ID, proposed.proposal, evaluation({ proposalId: proposed.proposal.id }))
  assert.equal(deps.port.promoteCalls.length, 1)
  assert.equal(deps.port.promoteCalls[0]?.proposal.id, proposed.proposal.id)
  assert.equal(merged.verifiedUserId, USER_ID)
})

test("every stage is recorded to the audit ledger", async () => {
  const deps = baseDeps()
  const proposed = await proposeEvolutionGoverned(deps, USER_ID, input())
  await mergeEvolutionGoverned(deps, USER_ID, proposed.proposal, evaluation())

  const events = (deps.ledger as InMemoryActionLedger).list()
  const completed = events.filter((e) => e.status === "completed")
  assert.ok(completed.length >= 2, "expected at least a propose-completed and a merge-completed event")
  assert.ok(events.some((e) => e.type === EVOLUTION_PROPOSE_CAPABILITY))
  assert.ok(events.some((e) => e.type === EVOLUTION_MERGE_CAPABILITY))
})

// -- Authorization: identity ---------------------------------------------

test("propose rejects a claimed identity that does not match the verified one — analyze() is never called", async () => {
  const deps = baseDeps({ identityVerifier: identityVerifier(OTHER_USER_ID) })
  await assert.rejects(() => proposeEvolutionGoverned(deps, USER_ID, input()), /Action identity mismatch/)
  assert.equal(deps.port.analyzeCalls, 0)
})

test("merge rejects a claimed identity that does not match the verified one — promote() is never called", async () => {
  const deps = baseDeps({ identityVerifier: identityVerifier(OTHER_USER_ID) })
  await assert.rejects(() => mergeEvolutionGoverned(deps, USER_ID, proposal(), evaluation()), /Action identity mismatch/)
  assert.equal(deps.port.promoteCalls.length, 0)
})

// -- Authorization: policy denial ----------------------------------------

test("propose is denied by policy when self-modification proposals are disabled — analyze() is never called", async () => {
  const deps = baseDeps({ values: values({ selfModification: { allowEvolutionProposals: false } }) })
  await assert.rejects(
    () => proposeEvolutionGoverned(deps, USER_ID, input()),
    /Action denied by policy: evolution\.propose/,
  )
  assert.equal(deps.port.analyzeCalls, 0)
  assert.ok((deps.ledger as InMemoryActionLedger).list().some((e) => e.status === "denied"))
})

test("merge is NOT controlled by allowEvolutionProposals — it stays approval_required (not denied) regardless of that flag", async () => {
  const deps = baseDeps({ values: values({ selfModification: { allowEvolutionProposals: false } }) })
  // Merge should still succeed via the approval-receipt path even though
  // propose is disabled — the hard code_evolution+destructive floor in
  // risk-boundary-policy.ts is independent of allowEvolutionProposals.
  const merged = await mergeEvolutionGoverned(deps, USER_ID, proposal(), evaluation())
  assert.equal(deps.port.promoteCalls.length, 1)
  assert.equal(merged.proposal.id, proposal().id)
})

test("policy.self_modify is hard-denied through this composed policy too — never merely approval-gated", async () => {
  const deps = baseDeps()
  const policy = new JhadinaValuesActionPolicy<EvolutionMergeAction>(EVOLUTION_SECURITY_POLICY, deps.values)
  const decision = await policy.evaluate({
    id: "req-self-modify",
    userId: USER_ID,
    type: "policy.self_modify",
    action: { proposal: proposal(), evaluation: evaluation() },
    requestedAt: new Date().toISOString(),
  })
  assert.equal(decision, "deny")
})

test("an unclassified/forged evolution-like capability is denied, not silently allowed", async () => {
  const deps = baseDeps()
  const policy = new JhadinaValuesActionPolicy(EVOLUTION_SECURITY_POLICY, deps.values)
  const decision = await policy.evaluate({
    id: "req-forged",
    userId: USER_ID,
    type: "evolution.destroy",
    action: {},
    requestedAt: new Date().toISOString(),
  })
  assert.equal(decision, "deny")
})

// -- Receipt lifecycle, replay, and capability/action binding ------------

test("replay: a receipt already consumed by one execution cannot authorize a second, even for the identical request", async () => {
  const deps = baseDeps()
  const ledger = deps.ledger
  const approvalStore = deps.approvalStore
  const policy = new JhadinaValuesActionPolicy<EvolutionProposeAction>(EVOLUTION_SECURITY_POLICY, deps.values)
  const fingerprint = "evolution:evolution.propose:fixed-action-id"

  const request = {
    id: "fixed-action-id",
    userId: USER_ID,
    type: EVOLUTION_PROPOSE_CAPABILITY,
    action: { input: input() },
    requestedAt: new Date().toISOString(),
  }

  const approvalService = createApprovalRequestService<EvolutionProposeAction>(approvalStore, () => fingerprint)
  const pending = await approvalService.requestApproval(request)
  const approved = await approvalService.approve(pending.id, USER_ID)

  const verifier = createApprovalReceiptVerifier<EvolutionProposeAction>(approvalStore, () => fingerprint)
  const executor = new ActionExecutor<EvolutionProposeAction, ImprovementProposal>(
    policy,
    ledger,
    [createEvolutionProposeHandler(deps.port)],
    verifier,
  )

  const first = await executor.execute({ ...request, approvalReceiptId: approved.id })
  assert.ok(first)
  assert.equal(deps.port.analyzeCalls, 1)

  // Same request, same already-consumed receipt id: must be rejected, and
  // analyze() must not run a second time.
  await assert.rejects(
    () => executor.execute({ ...request, approvalReceiptId: approved.id }),
    /Invalid approval receipt/,
  )
  assert.equal(deps.port.analyzeCalls, 1)
})

test("capability mismatch: a receipt issued for evolution.propose cannot authorize evolution.merge", async () => {
  const deps = baseDeps()
  const proposePolicy = new JhadinaValuesActionPolicy<EvolutionProposeAction>(EVOLUTION_SECURITY_POLICY, deps.values)
  const mergePolicy = new JhadinaValuesActionPolicy<EvolutionMergeAction>(EVOLUTION_SECURITY_POLICY, deps.values)

  const proposeFingerprint = "evolution:evolution.propose:shared-id"
  const proposeRequest = {
    id: "shared-id",
    userId: USER_ID,
    type: EVOLUTION_PROPOSE_CAPABILITY,
    action: { input: input() },
    requestedAt: new Date().toISOString(),
  }
  const proposeApprovalService = createApprovalRequestService<EvolutionProposeAction>(deps.approvalStore, () => proposeFingerprint)
  const pending = await proposeApprovalService.requestApproval(proposeRequest)
  const approvedProposeReceipt = await proposeApprovalService.approve(pending.id, USER_ID)

  // Attempt to spend the propose-scoped receipt against a merge request
  // with the same action id — different capability, different fingerprint.
  const mergeFingerprint = "evolution:evolution.merge:shared-id"
  const mergeRequest = {
    id: "shared-id",
    userId: USER_ID,
    type: EVOLUTION_MERGE_CAPABILITY,
    action: { proposal: proposal(), evaluation: evaluation() },
    requestedAt: new Date().toISOString(),
  }
  const mergeVerifier = createApprovalReceiptVerifier<EvolutionMergeAction>(deps.approvalStore, () => mergeFingerprint)
  const mergeExecutor = new ActionExecutor<EvolutionMergeAction, ImprovementProposal>(
    mergePolicy,
    deps.ledger,
    [createEvolutionMergeHandler(deps.port)],
    mergeVerifier,
  )

  await assert.rejects(
    () => mergeExecutor.execute({ ...mergeRequest, approvalReceiptId: approvedProposeReceipt.id }),
    /Invalid approval receipt/,
  )
  assert.equal(deps.port.promoteCalls.length, 0)
  void proposePolicy // referenced for symmetry/documentation; not evaluated in this test
})

test("expiry: a receipt older than its TTL is rejected even though it was validly approved", async (t) => {
  mock.timers.enable({ apis: ["Date"] })
  t.after(() => mock.timers.reset())

  const deps = baseDeps()
  const policy = new JhadinaValuesActionPolicy<EvolutionProposeAction>(EVOLUTION_SECURITY_POLICY, deps.values)
  const fingerprint = "evolution:evolution.propose:expiring-id"
  const request = {
    id: "expiring-id",
    userId: USER_ID,
    type: EVOLUTION_PROPOSE_CAPABILITY,
    action: { input: input() },
    requestedAt: new Date().toISOString(),
  }

  const approvalService = createApprovalRequestService<EvolutionProposeAction>(deps.approvalStore, () => fingerprint)
  const pending = await approvalService.requestApproval(request)
  const approved = await approvalService.approve(pending.id, USER_ID)

  // Approval receipts carry a fixed 5-minute TTL (createApprovalRequestService).
  mock.timers.tick(6 * 60_000)

  const verifier = createApprovalReceiptVerifier<EvolutionProposeAction>(deps.approvalStore, () => fingerprint)
  const executor = new ActionExecutor<EvolutionProposeAction, ImprovementProposal>(
    policy,
    deps.ledger,
    [createEvolutionProposeHandler(deps.port)],
    verifier,
  )

  await assert.rejects(() => executor.execute({ ...request, approvalReceiptId: approved.id }), /Invalid approval receipt/)
  assert.equal(deps.port.analyzeCalls, 0)
})

test("execute() without an approval receipt at all is rejected before the handler ever runs", async () => {
  const deps = baseDeps()
  const policy = new JhadinaValuesActionPolicy<EvolutionProposeAction>(EVOLUTION_SECURITY_POLICY, deps.values)
  const executor = new ActionExecutor<EvolutionProposeAction, ImprovementProposal>(
    policy,
    deps.ledger,
    [createEvolutionProposeHandler(deps.port)],
    // no approvalReceiptVerifier supplied at all
  )

  await assert.rejects(
    () =>
      executor.execute({
        id: "no-receipt-id",
        userId: USER_ID,
        type: EVOLUTION_PROPOSE_CAPABILITY,
        action: { input: input() },
        requestedAt: new Date().toISOString(),
      }),
    /Approval required/,
  )
  assert.equal(deps.port.analyzeCalls, 0)
})
