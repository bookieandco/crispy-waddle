import type { DecisionProposal, EvidenceRef } from "@jhadina/core-spine"
import {
  buildPresenceCampaign,
  listGrowthBrands,
  type CampaignMechanic,
  type SellableKind,
  type SellableOffer,
} from "@jhadina/growth-core"
import {
  createGrowthPresenceRepository,
  type GrowthPresenceRepository,
  type StoredPresenceCampaign,
} from "../growth/presence-repository"

export interface AskMarketingPresenceIntent {
  matched: true
  kind: SellableKind
  brandId?: string
  mechanic: CampaignMechanic
  explicitOfferName?: string
}

export interface AskMarketingPresenceWorkPlan {
  kind: "marketing_presence"
  authority: "PLANNING_ONLY"
  nextBoundary: "growth_research"
  brandId?: string
  sellableKind: SellableKind
  offerName?: string
  campaignId?: string
  persisted: boolean
  targetQuestions: readonly string[]
  notes: readonly string[]
}

export interface AskMarketingPresenceResult {
  proposal: DecisionProposal
  workPlan: AskMarketingPresenceWorkPlan
  storedCampaign?: StoredPresenceCampaign
  verified: true
  verificationReason: string
}

export interface AskMarketingPresenceOverrides {
  repository?: GrowthPresenceRepository
  now?: () => Date
  randomUUID?: () => string
}

const MARKETING_VERBS = /(market|marketing|promote|promotion|launch|grow|growth|sell|push|campaign|advertise|advertising)/
const SELLABLE_TERMS = /(song|track|single|album|music|merch|merchandise|shirt|hoodie|product|pupsonstuff|film|movie|video|service|software|app|store|shop|offer|release)/

export function inspectAskMarketingPresenceIntent(activeTask: string): AskMarketingPresenceIntent | null {
  const text = normalize(activeTask)
  if (!text || !MARKETING_VERBS.test(text) || !SELLABLE_TERMS.test(text)) return null
  if (/(paid ad|paid ads|meta ad|meta ads|google ad|google ads|ad spend|media buy)/.test(text)) return null

  const kind = inferKind(text)
  const brandId = inferBrandId(text, kind)
  const explicitOfferName = quotedName(activeTask)
  return {
    matched: true,
    kind,
    brandId,
    mechanic: inferMechanic(text),
    explicitOfferName,
  }
}

export async function handleAskMarketingPresenceCommand(
  input: {
    userId: string
    activeTask: string
    activeProject?: string
    artifacts?: readonly { id: string; name?: string }[]
  },
  overrides: AskMarketingPresenceOverrides = {},
): Promise<AskMarketingPresenceResult | null> {
  const intent = inspectAskMarketingPresenceIntent(input.activeTask)
  if (!intent) return null

  const now = overrides.now ?? (() => new Date())
  const randomUUID = overrides.randomUUID ?? (() => crypto.randomUUID())
  const repository = overrides.repository ?? createGrowthPresenceRepository()

  const offerName = resolveOfferName(intent, input.activeProject, input.artifacts ?? [])
  const brandId = intent.brandId
  const observedAt = now().toISOString()

  if (!brandId || !offerName) {
    const missing = [
      !brandId ? "which brand owns the offer" : null,
      !offerName ? "the exact song/product/film/service to market" : null,
    ].filter(Boolean)
    const proposal: DecisionProposal = {
      id: `ask-marketing-presence:${randomUUID()}`,
      contextId: `marketing-presence:${randomUUID()}`,
      disposition: "ASK",
      recommendation: `Specify ${missing.join(" and ")} so Jhadina can create one durable campaign record without guessing.`,
      rationale: "Marketing Presence may coordinate multiple content and discovery surfaces, so it requires a resolved offer and owner brand before durable planning begins.",
      evidence: [],
      uncertainty: ["No campaign was persisted and no external action was executed."],
      alternatives: [],
    }
    return {
      proposal,
      workPlan: {
        kind: "marketing_presence",
        authority: "PLANNING_ONLY",
        nextBoundary: "growth_research",
        brandId,
        sellableKind: intent.kind,
        offerName,
        persisted: false,
        targetQuestions: [],
        notes: ["Resolve the offer before campaign ideation, Director production, publication, or paid-media planning."],
      },
      verified: true,
      verificationReason: "Marketing intent classified; unresolved offer scope prevented persistence.",
    }
  }

  const campaignId = `presence:${randomUUID()}`
  const offerId = `offer:${slug(brandId)}:${slug(offerName)}`
  const evidenceRefs = [
    ...(input.activeProject ? [`project:${input.activeProject}`] : []),
    ...(input.artifacts ?? []).map((artifact) => artifact.id),
  ]
  if (!evidenceRefs.length) evidenceRefs.push(`user-command:${campaignId}`)

  const offer: SellableOffer = {
    id: offerId,
    brandId,
    name: offerName,
    kind: intent.kind,
    objective: objectiveFor(intent.kind),
    evidenceRefs,
  }

  const targetQuestions = defaultTargetQuestions(intent.kind, offerName)
  const campaign = buildPresenceCampaign({
    id: campaignId,
    brandId,
    concept: {
      id: `concept:${campaignId}`,
      name: `${offerName} presence campaign`,
      mechanic: intent.mechanic,
      thesis: "Turn verified offer evidence into one evidence-ranked campaign idea, platform-native derivatives, and durable answer/search surfaces.",
      hook: `Build proof-first interest around ${offerName}; Growth research must improve this draft hook before production.`,
      evidenceRefs,
      targetQuestions,
    },
    offers: [offer],
    createdAt: observedAt,
  })

  const storedCampaign = await repository.saveCampaign({
    userId: input.userId,
    campaign,
    offers: [offer],
    status: "draft",
  })

  const evidence: EvidenceRef[] = evidenceRefs.map((ref) => ({
    id: ref,
    source: ref.startsWith("project:") ? "active-project" : ref.startsWith("user-command:") ? "user-command" : "artifact",
    observedAt,
    summary: ref,
    immutable: false,
  }))
  evidence.push({
    id: campaign.id,
    source: "growth-presence-runtime",
    observedAt,
    summary: `Draft campaign persisted for brand=${brandId}; offer=${offerName}; kind=${intent.kind}; authority=PLANNING_ONLY.`,
    immutable: false,
  })

  const proposal: DecisionProposal = {
    id: `ask-marketing-presence:${randomUUID()}`,
    contextId: `marketing-presence:${campaign.id}`,
    disposition: "PROCEED",
    recommendation: `Campaign ${campaign.id} is now durable. Route it through Growth research to rank the Big Idea, query families, audience language, and evidence before Director production or Social publication.`,
    rationale: "The user explicitly requested marketing for a resolved sellable offer. Jhadina created a planning-only Presence Campaign so the same lineage can connect content, durable search/AEO surfaces, and downstream business outcomes.",
    evidence,
    uncertainty: [
      "The initial hook and target questions are planning scaffolds, not validated market claims.",
      "No social post, outreach, paid campaign, purchase, or external side effect was executed.",
    ],
    alternatives: ["Keep the campaign as a draft without starting Growth research."],
  }

  return {
    proposal,
    storedCampaign,
    workPlan: {
      kind: "marketing_presence",
      authority: "PLANNING_ONLY",
      nextBoundary: "growth_research",
      brandId,
      sellableKind: intent.kind,
      offerName,
      campaignId: campaign.id,
      persisted: true,
      targetQuestions,
      notes: [
        "Growth owns evidence ranking, audience/query research, and experiment design.",
        "Director owns generated media and production QC.",
        "Social publication and paid media remain separately approval-bound.",
      ],
    },
    verified: true,
    verificationReason: "Authenticated owner-scoped Presence Campaign persisted; only planning authority was created.",
  }
}

function inferKind(text: string): SellableKind {
  if (/(song|track|single|album|music|release)/.test(text)) return "music"
  if (/(merch|merchandise|shirt|hoodie)/.test(text)) return "merchandise"
  if (/(film|movie|video)/.test(text)) return "film"
  if (/(software|app)/.test(text)) return "software"
  if (/(service)/.test(text)) return "service"
  if (/(pupsonstuff|product|store|shop)/.test(text)) return "commerce"
  return "other"
}

function inferBrandId(text: string, kind: SellableKind): string | undefined {
  const brands = listGrowthBrands()
  const matched = brands.filter((brand) => {
    return brand.name.split(/\s+/).some((part) => part.length > 3 && text.includes(normalize(part)))
      || text.includes(normalize(brand.name))
      || text.includes(normalize(brand.brandId.replace(/^brand:/, "")))
      || (brand.brandId === "brand:pupsonstuff" && text.includes("pupsonstuff"))
  })
  if (matched.length === 1) return matched[0]!.brandId
  if (kind === "music") return "brand:atwood-bookie"
  if (text.includes("jhadina") || text.includes("director")) return "brand:jhadina"
  return undefined
}

function resolveOfferName(
  intent: AskMarketingPresenceIntent,
  activeProject: string | undefined,
  artifacts: readonly { id: string; name?: string }[],
): string | undefined {
  if (intent.explicitOfferName) return intent.explicitOfferName
  if (activeProject?.trim()) return activeProject.trim().slice(0, 160)
  const namedArtifact = artifacts.find((artifact) => artifact.name?.trim())
  if (namedArtifact?.name) return namedArtifact.name.trim().slice(0, 160)
  if (intent.brandId === "brand:pupsonstuff") return "PupsonStuff"
  return undefined
}

function inferMechanic(text: string): CampaignMechanic {
  if (/(challenge)/.test(text)) return "challenge"
  if (/(experiment|test)/.test(text)) return "experiment"
  if (/(meme)/.test(text)) return "meme"
  if (/(story|movie|film world|narrative)/.test(text)) return "story"
  if (/(launch|release)/.test(text)) return "launch"
  if (/(compare|comparison|versus| vs )/.test(` ${text} `)) return "comparison"
  return "demonstration"
}

function objectiveFor(kind: SellableKind): SellableOffer["objective"] {
  if (kind === "music") return "stream"
  if (kind === "merchandise" || kind === "commerce") return "sale"
  if (kind === "software" || kind === "service") return "lead"
  if (kind === "film" || kind === "content") return "awareness"
  return "awareness"
}

function defaultTargetQuestions(kind: SellableKind, offerName: string): string[] {
  switch (kind) {
    case "music":
      return [`What is ${offerName}?`, `Where can I listen to ${offerName}?`]
    case "merchandise":
    case "commerce":
      return [`What is ${offerName}?`, `How can I customize or buy ${offerName}?`]
    case "film":
    case "content":
      return [`What is ${offerName}?`, `Where can I watch ${offerName}?`]
    case "software":
    case "service":
      return [`What does ${offerName} do?`, `Who is ${offerName} for?`]
    default:
      return [`What is ${offerName}?`]
  }
}

function quotedName(value: string): string | undefined {
  const match = value.match(/["“]([^"”]{2,160})["”]/)
  return match?.[1]?.trim()
}

function slug(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "offer"
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim()
}
