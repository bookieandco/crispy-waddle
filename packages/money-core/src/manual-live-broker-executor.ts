import { randomUUID } from 'node:crypto'
import { requireBrokerAccountEntitlement, type BrokerAccountEntitlementStore } from './broker-account-entitlement.js'
import { createExecutionAttempt, type ExecutionAttempt, type ExecutionAttemptStore } from './execution-attempt.js'
import { authorizeAndConsumeMoneyPermit, type MoneyExecutionPermit } from './execution-permit-gate.js'
import type { PermitStore } from './execution-permit.js'
import type { ProviderExecutionEvent } from './execution-receipt-contracts.js'
import type { ExecutionPlan } from './execution-planning-contracts.js'
import type { LiveExecutionPreflight } from './live-preflight-contracts.js'
import type { LiveTradePermitPackage } from './live-trade-approval-bridge.js'
import {
  assertManualTrigger,
  type LiveBrokerOrderRequest,
  type LiveBrokerSubmissionResult,
  type ManualLiveBrokerAdapter,
  type ManualLiveExecutionTrigger,
} from './manual-live-broker-contracts.js'

export type ManualLiveExecutionResult = Readonly<{
  attempt: ExecutionAttempt
  providerEvent: ProviderExecutionEvent
  providerReference?: string
  state: 'SUBMITTED' | 'REJECTED' | 'UNKNOWN'
  retryAllowed: false
  authority: 'MANUAL_LIVE_EXECUTION'
}>

function permitView(pkg: LiveTradePermitPackage): MoneyExecutionPermit {
  return {
    permitId: pkg.permit.permitId,
    nonce: pkg.permit.nonce,
    authorityId: pkg.permit.binding.authorityId,
    actionRequestFingerprint: pkg.permit.binding.actionRequestFingerprint,
    policyVersion: pkg.permit.binding.policyVersion,
    policyHash: pkg.permit.binding.policyHash,
    approvalId: pkg.permit.binding.approvalId,
    opportunityId: pkg.permit.binding.opportunityId,
    riskDecisionId: pkg.permit.binding.riskDecisionId,
    allocationDecisionId: pkg.permit.binding.allocationDecisionId,
  }
}

function assertLiveTradeInstrument(instrumentId: string) {
  if (
    !instrumentId.startsWith('stock:') &&
    !instrumentId.startsWith('etf:') &&
    !instrumentId.startsWith('forex:')
  ) {
    throw new Error('MONEY_049_INSTRUMENT_NOT_MANUAL_LIVE_ELIGIBLE')
  }
}

function orderFrom(input: {
  pkg: LiveTradePermitPackage
  plan: ExecutionPlan
  attempt: ExecutionAttempt
}): LiveBrokerOrderRequest {
  const { pkg, plan, attempt } = input
  if (plan.slices.length !== 1) {
    throw new Error('MONEY_049_ONE_PERMIT_ONE_ORDER_REQUIRED')
  }
  const slice = plan.slices[0]!
  if (
    pkg.action.amount !== plan.notional.minor.toString() ||
    pkg.action.instrumentId !== plan.instrumentId ||
    pkg.action.side !== plan.side ||
    pkg.action.executionPlanId !== plan.executionPlanId
  ) {
    throw new Error('MONEY_049_PERMIT_PLAN_MISMATCH')
  }
  return Object.freeze({
    clientOrderId: attempt.idempotencyKey,
    accountId: pkg.action.accountId!,
    instrumentId: plan.instrumentId,
    side: plan.side,
    orderType: 'LIMIT',
    notionalMinor: plan.notional.minor.toString(),
    limitPriceMinor: slice.limitPriceMinor.toString(),
    currency: plan.notional.currency,
    timeInForce: 'DAY',
  })
}

function eventFrom(input: {
  attempt: ExecutionAttempt
  result?: LiveBrokerSubmissionResult
  now: string
}): ProviderExecutionEvent {
  if (input.result) {
    const result = input.result
    return Object.freeze({
      eventId: 'live-submit:' + input.attempt.attemptId + ':' + result.providerEventId,
      providerEventId: result.providerEventId,
      provider: input.attempt.provider,
      executionId: input.attempt.attemptId,
      actionFingerprint: input.attempt.actionFingerprint,
      providerReference: result.providerReference,
      state: result.state,
      occurredAt: result.occurredAt,
      observedAt: result.observedAt,
      receivedAt: result.receivedAt,
      availableAt: result.availableAt,
      sequence: 1,
      evidenceIds: Object.freeze([...result.evidenceIds]),
      payloadHash: input.attempt.idempotencyKey + ':' + result.providerEventId,
      provenanceHash: input.attempt.actionFingerprint + ':' + result.providerEventId,
      authority: 'EVIDENCE_ONLY',
    })
  }

  const evidenceId = 'live-submit-unknown:' + input.attempt.attemptId
  return Object.freeze({
    eventId: evidenceId,
    providerEventId: evidenceId,
    provider: input.attempt.provider,
    executionId: input.attempt.attemptId,
    actionFingerprint: input.attempt.actionFingerprint,
    state: 'UNKNOWN',
    occurredAt: input.now,
    observedAt: input.now,
    receivedAt: input.now,
    availableAt: input.now,
    sequence: 1,
    evidenceIds: Object.freeze([evidenceId]),
    payloadHash: evidenceId,
    provenanceHash: input.attempt.actionFingerprint + ':unknown',
    authority: 'EVIDENCE_ONLY',
  })
}

function completedAttempt(
  attempt: ExecutionAttempt,
  input: {
    state: ExecutionAttempt['state']
    providerReference?: string
    errorCode?: string
    errorMessage?: string
    recoveryRequired: boolean
    completedAt: string
  },
): ExecutionAttempt {
  return {
    ...attempt,
    state: input.state,
    providerReference: input.providerReference,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    recoveryRequired: input.recoveryRequired,
    completedAt: input.completedAt,
  }
}

export async function executeManualLiveTrade(input: {
  adapter: ManualLiveBrokerAdapter
  permitStore: PermitStore
  attemptStore: ExecutionAttemptStore
  entitlementStore: BrokerAccountEntitlementStore
  permitPackage: LiveTradePermitPackage
  preflight: LiveExecutionPreflight
  plan: ExecutionPlan
  trigger: ManualLiveExecutionTrigger
  now: string
  attemptIdFactory?: () => string
}): Promise<ManualLiveExecutionResult> {
  const { permitPackage: pkg, preflight, plan } = input

  if (pkg.autonomous || pkg.mode !== 'MANUAL_LIVE_ONLY') {
    throw new Error('MONEY_049_MANUAL_PERMIT_REQUIRED')
  }
  if (pkg.action.capability !== 'money.trade.submit' || pkg.request.type !== 'money.trade.submit') {
    throw new Error('MONEY_049_TRADE_CAPABILITY_REQUIRED')
  }
  if (input.adapter.environment !== 'LIVE' || input.adapter.provider !== pkg.action.provider) {
    throw new Error('MONEY_049_PROVIDER_BINDING_MISMATCH')
  }
  if (
    preflight.preflightId !== pkg.action.preflightId ||
    preflight.executionPlanId !== pkg.action.executionPlanId ||
    preflight.provider !== pkg.action.provider ||
    preflight.accountId !== pkg.action.accountId
  ) {
    throw new Error('MONEY_049_PREFLIGHT_BINDING_MISMATCH')
  }
  if (
    preflight.status !== 'PASS_FOR_HUMAN_APPROVAL' ||
    input.now >= preflight.expiresAt ||
    input.now >= pkg.permit.expiresAt
  ) {
    throw new Error('MONEY_049_PREFLIGHT_OR_PERMIT_NOT_ACTIVE')
  }

  assertLiveTradeInstrument(plan.instrumentId)
  assertManualTrigger(input.trigger, {
    userId: pkg.request.userId,
    approvalReceiptId: pkg.approvalReceiptId,
    notBefore: pkg.authority.authorizedAt,
    notAfter: pkg.permit.expiresAt,
  })
  await requireBrokerAccountEntitlement(input.entitlementStore, {
    userId: pkg.request.userId,
    provider: pkg.action.provider,
    accountId: pkg.action.accountId!,
    capability: 'money.trade.submit',
    now: input.now,
  })

  const attempt = createExecutionAttempt({
    attemptId: input.attemptIdFactory?.() ?? randomUUID(),
    requestId: pkg.request.id,
    permitId: pkg.permit.permitId,
    action: pkg.action,
    operation: 'money.trade.submit',
    now: input.now,
  })
  const request = orderFrom({ pkg, plan, attempt })

  await authorizeAndConsumeMoneyPermit(
    input.permitStore,
    permitView(pkg),
    pkg.request,
    pkg.action,
    input.now,
  )
  await input.attemptStore.start(attempt)

  try {
    const result = await input.adapter.submitOrder(
      Object.freeze({
        environment: 'LIVE',
        executionId: attempt.attemptId,
        idempotencyKey: attempt.idempotencyKey,
        actionFingerprint: attempt.actionFingerprint,
        permitId: pkg.permit.permitId,
        userId: pkg.request.userId,
        manualTriggerId: input.trigger.triggerId,
        now: input.now,
      }),
      request,
    )
    const providerEvent = eventFrom({ attempt, result, now: input.now })

    if (result.state === 'UNKNOWN') {
      const outcome = {
        state: 'UNKNOWN' as const,
        providerReference: result.providerReference,
        errorCode: 'MONEY_PROVIDER_OUTCOME_UNKNOWN',
        recoveryRequired: true,
      }
      await input.attemptStore.complete(attempt.attemptId, outcome, input.now)
      return Object.freeze({
        attempt: completedAttempt(attempt, { ...outcome, completedAt: input.now }),
        providerEvent,
        providerReference: result.providerReference,
        state: 'UNKNOWN',
        retryAllowed: false,
        authority: 'MANUAL_LIVE_EXECUTION',
      })
    }

    if (result.state === 'REJECTED') {
      const outcome = {
        state: 'FAILED' as const,
        providerReference: result.providerReference,
        errorCode: 'MONEY_PROVIDER_REJECTED',
        recoveryRequired: false,
      }
      await input.attemptStore.complete(attempt.attemptId, outcome, input.now)
      return Object.freeze({
        attempt: completedAttempt(attempt, { ...outcome, completedAt: input.now }),
        providerEvent,
        providerReference: result.providerReference,
        state: 'REJECTED',
        retryAllowed: false,
        authority: 'MANUAL_LIVE_EXECUTION',
      })
    }

    const outcome = {
      state: 'SUCCEEDED' as const,
      providerReference: result.providerReference,
      recoveryRequired: false,
    }
    await input.attemptStore.complete(attempt.attemptId, outcome, input.now)
    return Object.freeze({
      attempt: completedAttempt(attempt, { ...outcome, completedAt: input.now }),
      providerEvent,
      providerReference: result.providerReference,
      state: 'SUBMITTED',
      retryAllowed: false,
      authority: 'MANUAL_LIVE_EXECUTION',
    })
  } catch (error) {
    const providerEvent = eventFrom({ attempt, now: input.now })
    const outcome = {
      state: 'UNKNOWN' as const,
      errorCode: 'MONEY_PROVIDER_OUTCOME_UNKNOWN',
      errorMessage: error instanceof Error ? error.message : String(error),
      recoveryRequired: true,
    }
    await input.attemptStore.complete(attempt.attemptId, outcome, input.now)
    return Object.freeze({
      attempt: completedAttempt(attempt, { ...outcome, completedAt: input.now }),
      providerEvent,
      state: 'UNKNOWN',
      retryAllowed: false,
      authority: 'MANUAL_LIVE_EXECUTION',
    })
  }
}
