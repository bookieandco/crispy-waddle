import type { DecisionProposal, EvidenceRef, GrowthDomainContext } from "@jhadina/core-spine"
import { listGrowthBrands } from "@jhadina/growth-core"
import { resolveSocialCharacterProfiles } from "@jhadina/social-core"
import {
  createProductionGrowthContextProvider,
  type ProductionGrowthContextProvider,
} from "../context/production-growth-context-provider"

export type AskGrowthReadOperation =
  | "overview"
  | "list_campaigns"
  | "campaign_attention"
  | "list_audiences"
  | "pending_work"
  | "performance"

export interface AskGrowthReadIntent {
  operation: AskGrowthReadOperation
  matched: true
  requestedChannels: readonly string[]
  requestedBrandIds: readonly string[]
}

export interface AskGrowthWorkPlan {
  kind: "growth_intelligence"
  operation: AskGrowthReadOperation
  authority: "READ_ONLY"
  nextBoundary: "growth_read_only"
  campaigns: readonly EvidenceRef[]
  audiences: readonly EvidenceRef[]
  pendingWork: readonly EvidenceRef[]
  performance: readonly EvidenceRef[]
  attention: readonly EvidenceRef[]
  notes: readonly string[]
}

export interface AskGrowthCommandResult {
  proposal: DecisionProposal
  reasoningEventId: string
  workPlan: AskGrowthWorkPlan
  verified: true
  verificationReason: string
}

export interface AskGrowthCommandOverrides {
  provider?: ProductionGrowthContextProvider
}

export function inspectAskGrowthReadIntent(activeTask: string): AskGrowthReadIntent | null {
  const text = normalize(activeTask)
  if (!text) return null

  const growthSignal = [
    "growth", "campaign", "paid ad", "paid media", "meta", "google ads",
    "tiktok ads", "linkedin ads", "reddit ads", "audience", "lookalike",
    "retarget", "attribution", "roas", "cac", "mer", "lifecycle",
  ].some((signal) => text.includes(signal))
  if (!growthSignal) return null

  const mutating =
    /\b(create|launch|start|pause|resume|approve|publish|schedule|send|increase|decrease|set|change|duplicate)\b/.test(text)
    || /\brun\s+(?:a|an|the|this|new)\b/.test(text)
  if (mutating) return null

  const readSignal =
    /\b(show|list|what|which|status|current|existing|how|performance|results?|metrics?|attention|pending|awaiting|overview|doing|spend|roas|cac|mer)\b/.test(text)
    || /need(?:s)?\s+(?:work|attention)/.test(text)
  if (!readSignal) return null

  let operation: AskGrowthReadOperation = "overview"
  if (/\b(pending|awaiting|approval|approvals|queue|queued)\b/.test(text)) operation = "pending_work"
  else if (/\b(audience|audiences|lookalike|retargeting|retarget)\b/.test(text)) operation = "list_audiences"
  else if (/\b(attention|failed|failure|error|errors|problem|problems|fix)\b/.test(text) || /need(?:s)?\s+(?:work|attention)/.test(text)) operation = "campaign_attention"
  else if (/\b(performance|results?|metrics?|roas|cac|mer|spend|doing)\b/.test(text)) operation = "performance"
  else if (/\bcampaigns?\b/.test(text) || /\bmeta\b/.test(text)) operation = "list_campaigns"

  return {\n    matched: true,\n    operation,\n    requestedChannels: inferChannels(text),\n    requestedBrandIds: inferBrandIds(activeTask),\n  }\n}

export async function handleAskGrowthReadCommand(
  input: {
    userId: string
    activeTask: string
  },
  overrides: AskGrowthCommandOverrides = {},
): Promise<AskGrowthCommandResult | null> {
  const intent = inspectAskGrowthReadIntent(input.activeTask)
  if (!intent) return null

  const provider = overrides.provider ?? createProductionGrowthContextProvider()
  const context = await provider.getContext(input)
  if (!context) return null
  const scoped = scopeContext(context, intent)

  const workPlan: AskGrowthWorkPlan = {
    kind: "growth_intelligence",
    operation: intent.operation,
    authority: "READ_ONLY",
    nextBoundary: "growth_read_only",
    campaigns: scoped.campaigns,
    audiences: scoped.audiences,
    pendingWork: scoped.pendingWork,
    performance: scoped.performance,
    attention: scoped.attention,
    notes: [
      "This is authenticated read-only Growth intelligence.",
      "No paid-ad approval receipt was created, approved, consumed, or widened.",
      "No audience, campaign, lifecycle action, budget, or provider state was mutated.",
      ...context.limitations,
    ],
  }

  const selectedEvidence = evidenceFor(intent.operation, scoped)
  const proposal: DecisionProposal = {
    id: `ask-growth:${crypto.randomUUID()}`,
    contextId: `growth-command:${crypto.randomUUID()}`,
    disposition: "PROCEED",
    recommendation: recommendationFor(intent.operation, scoped),
    rationale: "The request is a Growth-state read. Jhadina used authenticated durable Growth records and returned evidence without crossing the paid-media or lifecycle execution boundary.",
    evidence: selectedEvidence,
    uncertainty: [...scoped.uncertainty, ...scoped.limitations],
    alternatives: [],
  }

  return {
    proposal,
    reasoningEventId: `growth-command:${crypto.randomUUID()}`,
    workPlan,
    verified: true,
    verificationReason: "Growth state was read through the owner-scoped read-only intelligence boundary; no external or financial action was executed.",
  }
}

function evidenceFor(
  operation: AskGrowthReadOperation,
  context: GrowthDomainContext,
): EvidenceRef[] {
  switch (operation) {
    case "list_campaigns":
      return context.campaigns
    case "campaign_attention":
      return context.attention
    case "list_audiences":
      return context.audiences
    case "pending_work":
      return context.pendingWork
    case "performance":
      return context.performance.length ? context.performance : context.campaigns
    case "overview":
      return [
        ...context.attention.slice(0, 5),
        ...context.pendingWork.slice(0, 5),
        ...context.campaigns.slice(0, 5),
        ...context.audiences.slice(0, 5),
      ]
  }
}

function recommendationFor(
  operation: AskGrowthReadOperation,
  context: GrowthDomainContext,
): string {
  switch (operation) {
    case "list_campaigns":
      return context.campaigns.length
        ? `I found ${context.campaigns.length} durable paid campaign record(s). The campaign evidence below shows brand, channel, provider, status, and approved budget envelope.`
        : "I do not see any durable paid campaign records for the authenticated user."
    case "campaign_attention":
      if (!context.attention.length) return "I do not see any durable paid campaign records to rank for attention."
      return `Growth campaign attention queue: ${context.attention.slice(0, 5).map((ref) => summarizeAttention(ref.summary)).join(" | ")}.`
    case "list_audiences":
      return context.audiences.length
        ? `I found ${context.audiences.length} durable Growth audience record(s). Raw audience definitions and customer membership data are intentionally not included in Ask Jhadina's general context.`
        : "I do not see any durable Growth audience records for the authenticated user."
    case "pending_work":
      return context.pendingWork.length
        ? `I found ${context.pendingWork.length} Growth item(s) awaiting attention, approval, dispatch resolution, or lifecycle review. These are read-only findings; no approval was granted.`
        : "I do not see any pending Growth approval, dispatch exception, or lifecycle work in the current durable records."
    case "performance":
      return context.performance.length
        ? `I found ${context.performance.length} recent provider performance observation(s). Metrics are reported as stored; missing metrics are unavailable rather than treated as zero.`
        : "I do not see provider performance observations for the current Growth campaigns."
    case "overview":
      return `Growth overview: ${context.campaigns.length} campaign(s), ${context.audiences.length} audience(s), ${context.pendingWork.length} pending-work item(s), and ${context.performance.length} recent provider observation(s).`
  }
}

function summarizeAttention(summary: string): string {
  const name = /name=([^;]+)/.exec(summary)?.[1]?.trim() ?? "campaign"
  const score = /attentionScore=([^;]+)/.exec(summary)?.[1]?.trim() ?? "unknown"
  const reasons = /reasons=(.+)$/.exec(summary)?.[1]?.trim() ?? "no reason available"
  return `${name} (score ${score}: ${reasons})`
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()
}

function inferChannels(text: string): string[] {
  const aliases: Array<[string, readonly string[]]> = [
    ["meta", ["meta", "facebook ads", "instagram ads"]],
    ["google", ["google ads", "google"]],
    ["tiktok", ["tiktok ads", "tik tok ads"]],
    ["linkedin", ["linkedin ads"]],
    ["reddit", ["reddit ads"]],
    ["microsoft", ["microsoft ads", "bing ads"]],
    ["pinterest", ["pinterest ads"]],
    ["snapchat", ["snapchat ads", "snap ads"]],
    ["amazon", ["amazon ads"]],
    ["dv360", ["dv360", "display video 360"]],
  ]
  return aliases
    .filter(([, terms]) => terms.some((term) => text.includes(term)))
    .map(([channel]) => channel)
}

function inferBrandIds(activeTask: string): string[] {
  const text = normalize(activeTask)
  const ids = new Set<string>()

  for (const brand of listGrowthBrands()) {
    const rawId = String(brand.brandId)
    const terms = [brand.name, rawId, rawId.replace(/^brand:/, "")]
    if (terms.some((term) => text.includes(normalize(term)))) ids.add(rawId)
  }

  for (const profile of resolveSocialCharacterProfiles(activeTask)) {
    ids.add("brand:" + profile.brand)
  }

  return [...ids].sort()
}

function scopeContext(context: GrowthDomainContext, intent: AskGrowthReadIntent): GrowthDomainContext {
  const channels = new Set(intent.requestedChannels)
  const brands = new Set(intent.requestedBrandIds)
  const campaignMatches = (ref: EvidenceRef) =>
    (!channels.size || channels.has(field(ref.summary, "channel") ?? ""))
    && (!brands.size || brands.has(field(ref.summary, "brand") ?? ""))

  const campaigns = context.campaigns.filter(campaignMatches)
  const campaignIds = new Set(campaigns.map((ref) => field(ref.summary, "campaignId")).filter((value): value is string => !!value))
  const hasCampaignScope = channels.size > 0 || brands.size > 0

  const attention = context.attention.filter((ref) => !hasCampaignScope || campaignMatches(ref))
  const performance = context.performance.filter((ref) => {
    if (!hasCampaignScope) return true
    const campaignId = field(ref.summary, "campaignId")
    return !!campaignId && campaignIds.has(campaignId)
  })
  const pendingWork = context.pendingWork.filter((ref) => {
    if (!hasCampaignScope) return true
    const campaignId = field(ref.summary, "campaignId")
    return !!campaignId && campaignIds.has(campaignId)
  })
  const audiences = context.audiences.filter((ref) =>
    !brands.size || brands.has(field(ref.summary, "brand") ?? ""),
  )

  const uncertainty = [...context.uncertainty]
  if (hasCampaignScope && campaigns.length === 0) {
    const scope = [
      brands.size ? "brand(s) " + [...brands].join(", ") : "",
      channels.size ? "channel(s) " + [...channels].join(", ") : "",
    ].filter(Boolean).join("; ")
    uncertainty.push("No durable paid campaigns matched the requested scope: " + scope + ".")
  }

  return { ...context, campaigns, audiences, pendingWork, performance, attention, uncertainty }
}

function field(summary: string, name: string): string | undefined {
  const prefix = name + "="
  const part = summary.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix))
  return part?.slice(prefix.length).trim()
}