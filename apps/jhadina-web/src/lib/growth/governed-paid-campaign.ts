import {
  ActionExecutor,
  createApprovalReceiptVerifier,
  createApprovalRequestService,
  createBaseSecurityCoreActionPolicy,
  type ActionHandler,
  type ActionLedger,
  type ActionPolicy,
  type ApprovalReceiptStore,
} from "@jhadina/action-core"
import {
  PAID_AD_CAPABILITY,
  assertBudgetWithinCeiling,
  assertPaidCampaignPlan,
  fingerprintPaidAdPublishAction,
  fingerprintPaidCampaign,
  type PaidAdPublishAction,
  type PaidCampaignPlan,
  type PaidMediaChannel,
} from "@jhadina/growth-core"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import { createGrowthAuditLedger } from "./durable-audit-ledger"
import {
  createGrowthProductionRepository,
  type GrowthPaidCampaignRow,
  type GrowthPaidOutboxRow,
  type GrowthProductionRepository,
} from "./production-repository"
import { createGrowthPaidApprovalStore } from "./supabase-paid-approval-store"
import {
  createPaidMediaProvider,
  type PaidMediaProvider,
} from "./paid-media-provider"

export interface CreatePaidCampaignInput {
  brandId: string
  name: string
  objective: string
  channel: PaidMediaChannel
  provider?: string
  providerAccountId: string
  audienceIds: string[]
  creativeIds: string[]
  landingPageId?: string
  currency: string
  dailyBudgetMinor: number
  lifetimeBudgetMinor?: number
  startsAt?: string
  endsAt?: string
  idempotencyKey?: string
}

export interface RequestedPaidCampaign {
  campaign: GrowthPaidCampaignRow
  approvalReceiptId: string
  verifiedUserId: string
}

export interface PaidCampaignExecutionResult {
  campaign: GrowthPaidCampaignRow
  outbox: GrowthPaidOutboxRow
  providerState: "pending_configuration" | "delivered" | "failed" | "ambiguous"
  verifiedUserId: string
}

export type PaidMediaProviderFactory = (provider: string) => PaidMediaProvider

export interface PaidAdSpendCeilings {
  dailyMinor: number
  lifetimeMinor: number
  currency: string
}

export interface GovernedPaidCampaignOverrides {
  identityVerifier?: JhadinaIdentityVerifier
  ledger?: ActionLedger
  repository?: GrowthProductionRepository
  policy?: ActionPolicy<PaidAdPublishAction>
  approvalStoreFactory?: (repository: GrowthProductionRepository, campaignId: string) => ApprovalReceiptStore
  providerFactory?: PaidMediaProviderFactory
  spendCeilings?: PaidAdSpendCeilings
}

function configuredSpendCeilings(): PaidAdSpendCeilings {
  const dailyMinor = Number(process.env.GROWTH_AD_MAX_DAILY_BUDGET_MINOR ?? "")
  const lifetimeMinor = Number(process.env.GROWTH_AD_MAX_LIFETIME_BUDGET_MINOR ?? "")
  const currency = (process.env.GROWTH_AD_BUDGET_CURRENCY ?? "USD").toUpperCase()
  if (!Number.isSafeInteger(dailyMinor) || dailyMinor <= 0) throw new Error("GROWTH_PAID_AD_DAILY_CEILING_NOT_CONFIGURED")
  if (!Number.isSafeInteger(lifetimeMinor) || lifetimeMinor < dailyMinor) throw new Error("GROWTH_PAID_AD_LIFETIME_CEILING_NOT_CONFIGURED")
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("GROWTH_PAID_AD_BUDGET_CURRENCY_INVALID")
  return { dailyMinor, lifetimeMinor, currency }
}

function assertSpendWithinCeilings(
  dailyBudgetMinor: number,
  lifetimeBudgetMinor: number | null | undefined,
  currency: string,
  ceilings: PaidAdSpendCeilings,
): void {
  if (currency.toUpperCase() !== ceilings.currency) throw new Error("GROWTH_PAID_AD_BUDGET_CURRENCY_MISMATCH")
  assertBudgetWithinCeiling(dailyBudgetMinor, ceilings.dailyMinor)
  if (lifetimeBudgetMinor !== null && lifetimeBudgetMinor !== undefined) {
    assertBudgetWithinCeiling(lifetimeBudgetMinor, ceilings.lifetimeMinor)
  }
}

function planFromInput(id: string, input: CreatePaidCampaignInput): PaidCampaignPlan {
  return {
    id,
    brandId: input.brandId,
    name: input.name,
    objective: input.objective,
    channel: input.channel,
    audienceIds: input.audienceIds,
    creativeIds: input.creativeIds,
    landingPageId: input.landingPageId,
    currency: input.currency,
    dailyBudgetMinor: input.dailyBudgetMinor,
    lifetimeBudgetMinor: input.lifetimeBudgetMinor,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    providerAccountId: input.providerAccountId,
  }
}

function actionFromCampaign(campaign: GrowthPaidCampaignRow): PaidAdPublishAction {
  return {
    campaignId: campaign.id,
    requestFingerprint: campaign.request_fingerprint,
  }
}

function actionRequest(campaign: GrowthPaidCampaignRow) {
  return {
    id: campaign.action_id,
    userId: campaign.user_id,
    type: PAID_AD_CAPABILITY,
    action: actionFromCampaign(campaign),
    requestedAt: campaign.created_at,
  }
}

async function runtime(overrides: GovernedPaidCampaignOverrides) {
  return {
    identityVerifier: overrides.identityVerifier ?? await createRequestIdentityVerifier(),
    ledger: overrides.ledger ?? await createGrowthAuditLedger(),
    repository: overrides.repository ?? createGrowthProductionRepository(),
    policy: overrides.policy ?? createBaseSecurityCoreActionPolicy<PaidAdPublishAction>("growth-paid"),
    approvalStoreFactory: overrides.approvalStoreFactory ?? createGrowthPaidApprovalStore,
    providerFactory: overrides.providerFactory ?? createPaidMediaProvider,
    spendCeilings: overrides.spendCeilings ?? configuredSpendCeilings(),
  }
}

export async function requestPaidCampaign(
  input: CreatePaidCampaignInput,
  overrides: GovernedPaidCampaignOverrides = {},
): Promise<RequestedPaidCampaign> {
  const deps = await runtime(overrides)
  const identity = await deps.identityVerifier.verify({})
  const idempotencyKey = input.idempotencyKey?.trim() || crypto.randomUUID()
  assertSpendWithinCeilings(input.dailyBudgetMinor, input.lifetimeBudgetMinor, input.currency, deps.spendCeilings)
  const fingerprint = fingerprintPaidCampaign(planFromInput(idempotencyKey, input))
  assertPaidCampaignPlan(planFromInput(idempotencyKey, input))
  const actionId = `growth-paid-publish:${crypto.randomUUID()}`

  const campaign = await deps.repository.createPaidCampaign({
    actionId,
    brandId: input.brandId,
    name: input.name,
    objective: input.objective,
    channel: input.channel,
    provider: input.provider?.trim() || "markifact",
    providerAccountId: input.providerAccountId,
    audienceIds: input.audienceIds,
    creativeIds: input.creativeIds,
    landingPageId: input.landingPageId,
    currency: input.currency,
    dailyBudgetMinor: input.dailyBudgetMinor,
    lifetimeBudgetMinor: input.lifetimeBudgetMinor,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    requestFingerprint: fingerprint,
    idempotencyKey,
  })

  if (campaign.approval_receipt_id) {
    return {
      campaign,
      approvalReceiptId: campaign.approval_receipt_id,
      verifiedUserId: identity.userId,
    }
  }

  const request = actionRequest(campaign)
  const decision = await deps.policy.evaluate(request)

  await deps.ledger.append({
    id: `${campaign.action_id}:policy-evaluated`,
    actionId: campaign.action_id,
    userId: identity.userId,
    type: PAID_AD_CAPABILITY,
    status: decision === "deny" ? "denied" : "started",
    timestamp: new Date().toISOString(),
    metadata: { decision, campaignId: campaign.id, dailyBudgetMinor: campaign.daily_budget_minor, currency: campaign.currency },
  })

  if (decision === "deny") throw new Error("GROWTH_PAID_AD_DENIED")
  if (decision !== "approval_required") throw new Error("GROWTH_PAID_AD_MUST_REQUIRE_APPROVAL")

  const store = deps.approvalStoreFactory(deps.repository, campaign.id)
  const approvalService = createApprovalRequestService(
    store,
    (approvalRequest) => fingerprintPaidAdPublishAction(approvalRequest.action as PaidAdPublishAction),
  )
  const pending = await approvalService.requestApproval(request)

  await deps.ledger.append({
    id: `${campaign.action_id}:approval-required`,
    actionId: campaign.action_id,
    userId: identity.userId,
    type: PAID_AD_CAPABILITY,
    status: "approval_required",
    timestamp: new Date().toISOString(),
    metadata: { approvalReceiptId: pending.id, campaignId: campaign.id },
  })

  return {
    campaign: { ...campaign, approval_receipt_id: pending.id },
    approvalReceiptId: pending.id,
    verifiedUserId: identity.userId,
  }
}

async function dispatchAuthorizedJob(
  repository: GrowthProductionRepository,
  providerFactory: PaidMediaProviderFactory,
  job: GrowthPaidOutboxRow,
): Promise<{ outbox: GrowthPaidOutboxRow; providerState: PaidCampaignExecutionResult["providerState"] }> {
  if (job.status !== "pending") {
    return {
      outbox: job,
      providerState:
        job.status === "delivered" ? "delivered"
          : job.status === "failed" ? "failed"
            : job.status === "ambiguous" ? "ambiguous"
              : "pending_configuration",
    }
  }

  const provider = providerFactory(job.provider)
  if (!provider.configured) {
    return { outbox: job, providerState: "pending_configuration" }
  }

  const attempting = await repository.beginOutboxAttempt(job.id)
  try {
    const receipt = await provider.dispatch(attempting)
    if (receipt.state === "unknown") {
      const outbox = await repository.resolveOutbox(
        attempting.id,
        "ambiguous",
        receipt.providerOperationId,
        receipt.providerCampaignId,
        receipt.error ?? "GROWTH_PROVIDER_STATE_UNKNOWN",
      )
      return { outbox, providerState: "ambiguous" }
    }
    if (receipt.state === "failed") {
      const outbox = await repository.resolveOutbox(
        attempting.id,
        "failed",
        receipt.providerOperationId,
        receipt.providerCampaignId,
        receipt.error ?? "GROWTH_PROVIDER_REPORTED_FAILED",
      )
      return { outbox, providerState: "failed" }
    }
    const outbox = await repository.resolveOutbox(
      attempting.id,
      "delivered",
      receipt.providerOperationId,
      receipt.providerCampaignId,
    )
    return { outbox, providerState: "delivered" }
  } catch (error) {
    const outbox = await repository.resolveOutbox(
      attempting.id,
      "ambiguous",
      undefined,
      undefined,
      error instanceof Error ? error.message : String(error),
    )
    return { outbox, providerState: "ambiguous" }
  }
}

export async function approvePaidCampaign(
  campaignId: string,
  approvalReceiptId: string,
  overrides: GovernedPaidCampaignOverrides = {},
): Promise<PaidCampaignExecutionResult> {
  const deps = await runtime(overrides)
  const identity = await deps.identityVerifier.verify({})
  const campaign = await deps.repository.getPaidCampaign(identity.userId, campaignId)

  if (!campaign.approval_receipt_id || campaign.approval_receipt_id !== approvalReceiptId) {
    throw new Error("GROWTH_PAID_APPROVAL_RECEIPT_MISMATCH")
  }
  if (campaign.status !== "pending_approval") throw new Error("GROWTH_PAID_CAMPAIGN_NOT_AWAITING_APPROVAL")
  assertSpendWithinCeilings(campaign.daily_budget_minor, campaign.lifetime_budget_minor, campaign.currency, deps.spendCeilings)

  const store = deps.approvalStoreFactory(deps.repository, campaign.id)
  await store.approve(approvalReceiptId, identity.userId)

  const verifier = createApprovalReceiptVerifier(
    store,
    (approvalRequest) => fingerprintPaidAdPublishAction(approvalRequest.action as PaidAdPublishAction),
  )

  const handler: ActionHandler<PaidAdPublishAction, { outbox: GrowthPaidOutboxRow; providerState: PaidCampaignExecutionResult["providerState"] }> = {
    supports: (type) => type === PAID_AD_CAPABILITY,
    async execute(action, request) {
      const current = await deps.repository.getPaidCampaign(request.userId, action.campaignId)
      if (current.request_fingerprint !== action.requestFingerprint) {
        throw new Error("GROWTH_PAID_CAMPAIGN_MUTATED_AFTER_APPROVAL")
      }
      assertSpendWithinCeilings(current.daily_budget_minor, current.lifetime_budget_minor, current.currency, deps.spendCeilings)
      const outbox = await deps.repository.enqueuePaidCampaign(current.id)
      return dispatchAuthorizedJob(deps.repository, deps.providerFactory, outbox)
    },
  }

  const executor = new ActionExecutor(deps.policy, deps.ledger, [handler], verifier)
  const result = await executor.execute({
    ...actionRequest(campaign),
    approvalReceiptId,
  })
  const refreshed = await deps.repository.getPaidCampaign(identity.userId, campaign.id)

  return {
    campaign: refreshed,
    outbox: result.outbox,
    providerState: result.providerState,
    verifiedUserId: identity.userId,
  }
}

export async function dispatchQueuedPaidCampaign(
  campaignId: string,
  overrides: GovernedPaidCampaignOverrides = {},
): Promise<PaidCampaignExecutionResult> {
  const deps = await runtime(overrides)
  const identity = await deps.identityVerifier.verify({})
  const campaign = await deps.repository.getPaidCampaign(identity.userId, campaignId)
  assertSpendWithinCeilings(campaign.daily_budget_minor, campaign.lifetime_budget_minor, campaign.currency, deps.spendCeilings)
  const jobs = await deps.repository.listOutbox(identity.userId, campaignId)
  if (jobs.length !== 1) throw new Error("GROWTH_PAID_OUTBOX_CARDINALITY_INVALID")
  const result = await dispatchAuthorizedJob(deps.repository, deps.providerFactory, jobs[0])
  const refreshed = await deps.repository.getPaidCampaign(identity.userId, campaign.id)
  return { campaign: refreshed, outbox: result.outbox, providerState: result.providerState, verifiedUserId: identity.userId }
}
