import type { DecisionProposal, EvidenceRef } from "@jhadina/core-spine"
import {
  listSocialCharacterProfiles,
  resolveSocialCharacterProfiles,
  type JhadinaBrand,
  type SocialAccount,
  type SocialCharacterProfile,
  type SocialObservation,
  type SocialOutboxJob,
  type SocialPlatform,
  type SocialPublicationProposal,
} from "@jhadina/social-core"
import {
  createSocialRepository,
  type SocialRepository,
} from "../social/repository"

export type AskSocialOperation =
  | "list_characters"
  | "account_attention"
  | "select_character_accounts"
  | "research_creative"
  | "produce_creative"
  | "analyze_performance"
  | "schedule_publish"
  | "paid_campaign"
  | "social_general"

export interface AskSocialIntent {
  matched: boolean
  operation: AskSocialOperation
  requestedPlatforms: readonly SocialPlatform[]
  requestedCharacterProfiles: readonly SocialCharacterProfile[]
  requestedBrand?: JhadinaBrand
  accountTerms: readonly string[]
}

export interface AskSocialAccountChoice {
  accountId: string
  brand: JhadinaBrand
  platform: SocialPlatform
  provider: string
  displayName: string
  handle?: string
  attentionScore: number
  attentionReasons: readonly string[]
}

export interface AskSocialWorkPlan {
  kind: "social_marketing"
  operation: AskSocialOperation
  character?: SocialCharacterProfile
  availableCharacters?: readonly SocialCharacterProfile[]
  accounts: readonly AskSocialAccountChoice[]
  requestedPlatforms: readonly SocialPlatform[]
  nextBoundary:
    | "social_read_only"
    | "growth_research"
    | "director_production"
    | "social_publication"
    | "growth_paid_media"
  authority:
    | "READ_ONLY"
    | "PLANNING_ONLY"
  requiresExplicitApprovalForExecution: boolean
  notes: readonly string[]
}

export interface AskSocialCommandResult {
  proposal: DecisionProposal
  reasoningEventId: string
  workPlan: AskSocialWorkPlan
  verified: true
  verificationReason: string
}

export interface AskSocialCommandOverrides {
  repository?: SocialRepository
  now?: () => Date
}

const PLATFORM_ALIASES: Readonly<Record<SocialPlatform, readonly string[]>> = {
  facebook: ["facebook", "fb"],
  instagram: ["instagram", "ig"],
  tiktok: ["tiktok", "tik tok"],
  youtube: ["youtube", "yt"],
  x: ["twitter", "x.com", " x "],
  linkedin: ["linkedin", "linked in"],
  threads: ["threads"],
  bluesky: ["bluesky", "blue sky"],
  reddit: ["reddit"],
  snapchat: ["snapchat", "snap"],
  tumblr: ["tumblr"],
  vk: ["vk"],
}

const SOCIAL_MARKERS = [
  "social", "instagram", "tiktok", "tik tok", "facebook", "linkedin", "youtube",
  "reddit", "twitter", "threads", "snapchat", "post", "content", "account",
  "personality", "character", "voice", "meta ad", "meta ads", "campaign",
  "creative", "reel", "shorts",
]

export function inspectAskSocialIntent(activeTask: string): AskSocialIntent | null {
  const text = normalize(activeTask)
  if (!text) return null

  const requestedCharacterProfiles = resolveSocialCharacterProfiles(activeTask)
  const strongSocialMarkers = [
    "social", "instagram", "tiktok", "tik tok", "facebook", "linkedin", "youtube",
    "reddit", "twitter", "threads", "snapchat", "meta ad", "meta ads", "reel", "shorts",
  ]
  const hasStrongSocialSignal = strongSocialMarkers.some((marker) => text.includes(normalize(marker)))
  const hasKnownCharacterSignal = requestedCharacterProfiles.length > 0
  if (!hasStrongSocialSignal && !hasKnownCharacterSignal) return null

  const requestedBrand = requestedCharacterProfiles.length === 1
    ? requestedCharacterProfiles[0]!.brand
    : inferBrand(activeTask)

  const requestedPlatforms = (Object.entries(PLATFORM_ALIASES) as Array<[SocialPlatform, readonly string[]]>)
    .filter(([, aliases]) => aliases.some((alias) => containsAlias(activeTask, alias)))
    .map(([platform]) => platform)

  const operation = classifyOperation(text)
  const accountTerms = extractAccountTerms(activeTask)

  return {
    matched: true,
    operation,
    requestedPlatforms,
    requestedCharacterProfiles,
    requestedBrand,
    accountTerms,
  }
}

export async function handleAskSocialCommand(
  input: {
    userId: string
    activeTask: string
  },
  overrides: AskSocialCommandOverrides = {},
): Promise<AskSocialCommandResult | null> {
  const intent = inspectAskSocialIntent(input.activeTask)
  if (!intent) return null

  const repository = overrides.repository ?? createSocialRepository()
  const now = overrides.now ?? (() => new Date())
  const [accounts, proposals, outbox, observations] = await Promise.all([
    repository.listAccounts(input.userId),
    repository.listProposals(input.userId),
    repository.listOutbox(input.userId),
    repository.listObservations(input.userId),
  ])

  const connected = accounts.filter((account) => account.status === "connected")
  const characterResolution = resolveCharacter(intent)
  const accountResolution = resolveAccounts({
    intent,
    connected,
    proposals,
    outbox,
    observations,
    now: now(),
  })

  const workPlan = buildWorkPlan(intent, characterResolution.character, accountResolution.accounts)
  const observedAt = now().toISOString()
  const evidence: EvidenceRef[] = [
    ...accountResolution.accounts.map((account) => ({
      id: `social-account:${account.accountId}`,
      source: "social-account",
      observedAt,
      summary: [
        `${account.displayName}`,
        `brand=${account.brand}`,
        `platform=${account.platform}`,
        `provider=${account.provider}`,
        account.handle ? `handle=@${account.handle.replace(/^@/, "")}` : null,
        `attentionScore=${account.attentionScore}`,
        `attentionReasons=${account.attentionReasons.join(" | ")}`,
      ].filter(Boolean).join("; "),
      immutable: false,
    })),
  ]

  if (characterResolution.character) {
    evidence.push({
      id: characterResolution.character.id,
      source: "social-character-registry",
      observedAt,
      summary: [
        `${characterResolution.character.label}`,
        `brand=${characterResolution.character.brand}`,
        `voice=${characterResolution.character.voiceProfileRef}`,
        `tone=${characterResolution.character.toneTraits.join(", ")}`,
        "authority=EXPRESSION_ONLY",
      ].join("; "),
      immutable: true,
    })
  }

  if (intent.operation === "list_characters") {
    for (const profile of listSocialCharacterProfiles()) {
      evidence.push({
        id: profile.id,
        source: "social-character-registry",
        observedAt,
        summary: `${profile.label}; brand=${profile.brand}; tone=${profile.toneTraits.join(", ")}; authority=EXPRESSION_ONLY`,
        immutable: true,
      })
    }
  }

  const clarification = characterResolution.error ?? accountResolution.error
  const recommendation = clarification
    ? clarification
    : recommendationFor(workPlan)
  const disposition: DecisionProposal["disposition"] = clarification ? "ASK" : "PROCEED"

  const proposal: DecisionProposal = {
    id: `ask-social:${crypto.randomUUID()}`,
    contextId: `social-command:${crypto.randomUUID()}`,
    disposition,
    recommendation,
    rationale: clarification
      ? "The Social command resolver only binds real configured character profiles and connected accounts; it will not guess an ambiguous or missing destination."
      : rationaleFor(workPlan),
    evidence,
    uncertainty: [
      ...(characterResolution.uncertainty ?? []),
      ...(accountResolution.uncertainty ?? []),
    ],
    alternatives: clarification
      ? buildAlternatives(connected)
      : [],
  }

  return {
    proposal,
    reasoningEventId: `social-command:${crypto.randomUUID()}`,
    workPlan,
    verified: true,
    verificationReason: "Social work plan resolved from authenticated Social repository state and governed character registry; no external action was executed.",
  }
}

function resolveCharacter(intent: AskSocialIntent): {
  character?: SocialCharacterProfile
  error?: string
  uncertainty?: string[]
} {
  if (intent.operation === "list_characters") return {}
  if (intent.requestedCharacterProfiles.length > 1) {
    return {
      error: `More than one character personality matched: ${intent.requestedCharacterProfiles.map((profile) => profile.label).join(", ")}. Name the one you want.`,
    }
  }
  if (intent.requestedCharacterProfiles.length === 1) {
    return { character: intent.requestedCharacterProfiles[0] }
  }
  if (intent.requestedBrand) {
    const profile = listSocialCharacterProfiles().find((candidate) => candidate.brand === intent.requestedBrand)
    return profile ? { character: profile } : {
      uncertainty: [`No active character profile is registered for brand ${intent.requestedBrand}.`],
    }
  }
  return {
    uncertainty: ["No character personality was explicitly selected; account/brand defaults may still be used for planning."],
  }
}

function resolveAccounts(input: {
  intent: AskSocialIntent
  connected: readonly SocialAccount[]
  proposals: readonly SocialPublicationProposal[]
  outbox: readonly SocialOutboxJob[]
  observations: readonly SocialObservation[]
  now: Date
}): {
  accounts: AskSocialAccountChoice[]
  error?: string
  uncertainty?: string[]
} {
  const { intent } = input
  let candidates = [...input.connected]

  if (intent.requestedBrand) {
    candidates = candidates.filter((account) => account.brand === intent.requestedBrand)
  }
  if (intent.requestedPlatforms.length) {
    candidates = candidates.filter((account) => intent.requestedPlatforms.includes(account.platform))
  }

  const explicitMatches = intent.accountTerms.length
    ? input.connected.filter((account) => {
        const haystack = normalize([
          account.id,
          account.displayName,
          account.handle ?? "",
          account.brand,
          account.platform,
        ].join(" "))
        return intent.accountTerms.some((term) => haystack.includes(normalize(term)))
      })
    : []

  if (explicitMatches.length) {
    candidates = explicitMatches.filter((account) =>
      (!intent.requestedBrand || account.brand === intent.requestedBrand)
      && (!intent.requestedPlatforms.length || intent.requestedPlatforms.includes(account.platform)),
    )
  }

  const choices = candidates
    .map((account) => accountChoice(account, input.proposals, input.outbox, input.observations, input.now))
    .sort((a, b) =>
      b.attentionScore - a.attentionScore
      || a.brand.localeCompare(b.brand)
      || a.platform.localeCompare(b.platform)
      || a.accountId.localeCompare(b.accountId),
    )

  const hadExplicitScope =
    !!intent.requestedBrand
    || intent.requestedPlatforms.length > 0
    || intent.accountTerms.length > 0

  if (hadExplicitScope && !choices.length) {
    const pieces = [
      intent.requestedBrand ? `brand ${intent.requestedBrand}` : null,
      intent.requestedPlatforms.length ? `platform(s) ${intent.requestedPlatforms.join(", ")}` : null,
      intent.accountTerms.length ? `account reference(s) ${intent.accountTerms.join(", ")}` : null,
    ].filter(Boolean)
    return {
      accounts: [],
      error: `I could not resolve a connected Social account for ${pieces.join("; ")}. Choose one of the connected accounts instead.`,
    }
  }

  return {
    accounts: choices,
    uncertainty: choices.length
      ? []
      : ["No connected Social accounts are currently available to the authenticated user."],
  }
}

function accountChoice(
  account: SocialAccount,
  proposals: readonly SocialPublicationProposal[],
  outbox: readonly SocialOutboxJob[],
  observations: readonly SocialObservation[],
  now: Date,
): AskSocialAccountChoice {
  let attentionScore = 0
  const attentionReasons: string[] = []

  const failed = outbox.filter((job) =>
    job.target.accountId === account.id
    && (job.status === "failed" || job.status === "ambiguous"),
  )
  if (failed.length) {
    attentionScore += 60
    attentionReasons.push(`${failed.length} failed/ambiguous delivery job(s)`)
  }

  const pending = proposals.filter((proposal) =>
    proposal.status === "pending_approval"
    && proposal.targets.some((target) => target.accountId === account.id),
  )
  if (pending.length) {
    attentionScore += 30
    attentionReasons.push(`${pending.length} publication proposal(s) awaiting approval`)
  }

  const performance = observations
    .filter((observation) => observation.accountId === account.id && observation.kind === "performance")
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))

  if (!performance.length) {
    attentionScore += 20
    attentionReasons.push("no performance observation available")
  } else {
    const ageMs = now.getTime() - Date.parse(performance[0]!.observedAt)
    const ageDays = Number.isFinite(ageMs) ? Math.max(0, ageMs / 86_400_000) : 0
    if (ageDays > 14) {
      attentionScore += 10
      attentionReasons.push(`latest performance observation is ${Math.floor(ageDays)} day(s) old`)
    }
  }

  if (!attentionReasons.length) attentionReasons.push("no operational exception detected")

  return {
    accountId: account.id,
    brand: account.brand,
    platform: account.platform,
    provider: account.provider,
    displayName: account.displayName,
    handle: account.handle,
    attentionScore,
    attentionReasons,
  }
}

function buildWorkPlan(
  intent: AskSocialIntent,
  character: SocialCharacterProfile | undefined,
  accounts: readonly AskSocialAccountChoice[],
): AskSocialWorkPlan {
  const nextBoundary = boundaryFor(intent.operation)
  return {
    kind: "social_marketing",
    operation: intent.operation,
    character,
    availableCharacters: intent.operation === "list_characters"
      ? listSocialCharacterProfiles()
      : undefined,
    accounts,
    requestedPlatforms: intent.requestedPlatforms,
    nextBoundary,
    authority: nextBoundary === "social_read_only" ? "READ_ONLY" : "PLANNING_ONLY",
    requiresExplicitApprovalForExecution:
      nextBoundary === "social_publication" || nextBoundary === "growth_paid_media",
    notes: [
      "Jhadina's learned PersonalityState controls how Jhadina speaks to the user; Social character profiles control public brand/content expression.",
      "Character selection grants expression constraints only and never account, publishing, outreach, or spend authority.",
      nextBoundary === "director_production"
        ? "Director owns generated media, continuity, provenance, QC, and review."
        : "",
    ].filter(Boolean),
  }
}

function boundaryFor(operation: AskSocialOperation): AskSocialWorkPlan["nextBoundary"] {
  switch (operation) {
    case "list_characters":
    case "account_attention":
    case "analyze_performance":
    case "social_general":
      return "social_read_only"
    case "research_creative":
      return "growth_research"
    case "produce_creative":
      return "director_production"
    case "schedule_publish":
      return "social_publication"
    case "paid_campaign":
      return "growth_paid_media"
    case "select_character_accounts":
      return "social_read_only"
  }
}

function recommendationFor(plan: AskSocialWorkPlan): string {
  if (plan.operation === "list_characters") {
    return `Available Social character personalities: ${(plan.availableCharacters ?? []).map((profile) => profile.label).join(", ")}.`
  }

  if (plan.operation === "account_attention") {
    if (!plan.accounts.length) return "No connected Social accounts are available."
    const top = plan.accounts.slice(0, 5)
    return `Work queue by current operational attention: ${top.map((account) =>
      `${account.displayName} (${account.platform}, score ${account.attentionScore}: ${account.attentionReasons.join("; ")})`
    ).join(" | ")}.`
  }

  const character = plan.character ? ` using the ${plan.character.label} character personality` : ""
  const accounts = plan.accounts.length
    ? ` on ${plan.accounts.map((account) => `${account.displayName}/${account.platform}`).join(", ")}`
    : ""

  switch (plan.operation) {
    case "select_character_accounts":
      return `Use the resolved Social configuration${character}${accounts}. This selects expression/account scope only; nothing was published.`
    case "research_creative":
      return `Route this request into Growth research${character}${accounts}, then return evidence-backed creative hypotheses before Director production.`
    case "produce_creative":
      return `Route the creative brief to Director${character}${accounts}; Director production still requires its canonical project/gate/QC lineage.`
    case "analyze_performance":
      return `Analyze authenticated Social observations for the resolved account scope${accounts}; treat missing metrics as unavailable, not zero.`
    case "schedule_publish":
      return `Prepare exact publication proposals${character}${accounts}; publishing still requires the existing public.publish approval receipts.`
    case "paid_campaign":
      return `Prepare a Growth paid-media campaign plan${character}${accounts}; spend still requires paid-ad.publish approval and budget limits.`
    default:
      return `Use the resolved Social scope${character}${accounts} for the next planning step.`
  }
}

function rationaleFor(plan: AskSocialWorkPlan): string {
  return [
    `Ask Jhadina resolved operation=${plan.operation} through the Social/Growth intelligence boundary.`,
    plan.character
      ? `Character ${plan.character.label} is an expression-only profile for brand ${plan.character.brand}.`
      : "No character mutation was performed.",
    `${plan.accounts.length} authenticated connected account(s) are in scope.`,
    `Next boundary=${plan.nextBoundary}; authority=${plan.authority}.`,
    plan.requiresExplicitApprovalForExecution
      ? "The requested downstream action is consequential and remains approval-bound."
      : "No external side effect is implied by this plan.",
  ].join(" ")
}

function buildAlternatives(accounts: readonly SocialAccount[]): string[] {
  return accounts
    .filter((account) => account.status === "connected")
    .sort(accountSort)
    .slice(0, 10)
    .map((account) =>
      `${account.displayName} — ${account.brand}/${account.platform}${account.handle ? ` @${account.handle.replace(/^@/, "")}` : ""}`,
    )
}

function classifyOperation(text: string): AskSocialOperation {
  if (/(what|which|list|show).*(personality|personalities|character|characters|voices?)/.test(text)) {
    return "list_characters"
  }
  if (/(which|what).*(accounts?).*(work|focus|attention)|accounts?.*(need|needs).*(work|attention)/.test(text)) {
    return "account_attention"
  }
  if (/(performance|analytics|analy[sz]e|how.*doing|results)/.test(text)) {
    return "analyze_performance"
  }
  if (/(research|competitor|ad library|hooks?|messages?|angles?)/.test(text)) {
    return "research_creative"
  }
  if (/(launch|run|spend|budget|paid campaign|meta campaign|campaign).*(ad|ads|campaign)?/.test(text)
    && /(meta|facebook|instagram|paid|campaign)/.test(text)) {
    return "paid_campaign"
  }
  if (/(schedule|publish|post this|post it|send this live)/.test(text)) {
    return "schedule_publish"
  }
  if (/(create|make|generate|produce|design|film|render).*(ad|creative|video|reel|short|image|graphic|content)/.test(text)) {
    return "produce_creative"
  }
  if (/(use|set|switch|assign).*(personality|character|voice)|personality.*(account|instagram|tiktok|facebook|youtube|linkedin)/.test(text)) {
    return "select_character_accounts"
  }
  return "social_general"
}

function inferBrand(activeTask: string): JhadinaBrand | undefined {
  const text = normalize(activeTask)
  const profiles = listSocialCharacterProfiles()
    .filter((profile) => {
      const aliases = [profile.brand, profile.label, ...profile.aliases]
      return aliases.some((alias) => text.includes(normalize(alias)))
    })
  const unique = [...new Set(profiles.map((profile) => profile.brand))]
  return unique.length === 1 ? unique[0] : undefined
}

function extractAccountTerms(activeTask: string): string[] {
  const matches = activeTask.match(/@[a-zA-Z0-9._-]+/g) ?? []
  return [...new Set(matches.map((value) => value.replace(/^@/, "")))]
}

function containsAlias(text: string, alias: string): boolean {
  const padded = ` ${normalize(text)} `
  const target = ` ${normalize(alias)} `
  return padded.includes(target)
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9@._-]+/g, " ").replace(/\s+/g, " ").trim()
}

function accountSort(a: SocialAccount, b: SocialAccount): number {
  return a.brand.localeCompare(b.brand)
    || a.platform.localeCompare(b.platform)
    || a.displayName.localeCompare(b.displayName)
    || a.id.localeCompare(b.id)
}
