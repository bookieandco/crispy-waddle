import type { DecisionProposal, EvidenceRef } from "@jhadina/core-spine"
import {
  buildSportsSimulationReport,
  renderSportsSimulationReportText,
  runCorrelatedSportsMonteCarlo,
  type SportsLatentFactor,
  type SportsPlayerStatModel,
  type SportsSimMarketLeg,
  type SportsSimSport,
  type SportsSimulationReport,
  type SportsSimulationRequestedStat,
  type SportsTeamScoreModel,
} from "@jhadina/money-core"

export interface AskSportsSimulationIntent {
  matched: true
  pathCount: number
  liveRequested: boolean
  rawRequest: string
}

export interface SportsSimulationResolvedContext {
  contextId: string
  eventId: string
  eventLabel: string
  sport: SportsSimSport
  observedAt: string
  currentHomeScore: number
  currentAwayScore: number
  teamModels: readonly SportsTeamScoreModel[]
  playerModels: readonly SportsPlayerStatModel[]
  latentFactors: readonly SportsLatentFactor[]
  marketLegs: readonly SportsSimMarketLeg[]
  jointSets: readonly Readonly<{ jointId: string; legIds: readonly string[] }>[]
  heavyTailRegimeBps: number
  requestedStats: readonly SportsSimulationRequestedStat[]
  assumptions: readonly string[]
  scenarioNotes: readonly string[]
  warnings: readonly string[]
  evidenceIds: readonly string[]
  source: "ADMITTED_SPORTS_CONTEXT" | "USER_SUPPLIED_CONTEXT"
}

export interface SportsSimulationContextProvider {
  resolve(input: {
    userId: string
    activeTask: string
    intent: AskSportsSimulationIntent
  }): Promise<SportsSimulationResolvedContext | null>
}

export interface AskSportsSimulationWorkPlan {
  kind: "sports_simulation"
  authority: "SIMULATION_ONLY"
  nextBoundary: "sports_simulation"
  pathCount: number
  liveRequested: boolean
  contextStatus: "RESOLVED" | "MISSING"
  eventId?: string
  eventLabel?: string
  notes: readonly string[]
}

export interface AskSportsSimulationResult {
  proposal: DecisionProposal
  workPlan: AskSportsSimulationWorkPlan
  report?: SportsSimulationReport
  verified: true
  verificationReason: string
}

export interface AskSportsSimulationOverrides {
  provider?: SportsSimulationContextProvider
  suppliedContext?: SportsSimulationResolvedContext
  now?: () => Date
}

const DEFAULT_PATHS = 10_000
const MIN_PATHS = 500
const MAX_PATHS = 100_000

export function inspectAskSportsSimulationIntent(activeTask: string): AskSportsSimulationIntent | null {
  const text = normalize(activeTask)
  if (!text) return null

  const simulate =
    /(simulate|simulation|monte carlo|run sims?|run simulations?)/.test(text)
    || /what if/.test(text) && /(game|match|fight|bout|event)/.test(text)
  if (!simulate) return null

  const pathMatch = activeTask.match(/(d[d,]{2,})s*(?:times|simulations?|sims?|runs?)/i)
  const parsed = pathMatch ? Number(pathMatch[1]!.replace(/,/g, "")) : DEFAULT_PATHS
  const pathCount = Number.isFinite(parsed)
    ? Math.max(MIN_PATHS, Math.min(MAX_PATHS, Math.floor(parsed)))
    : DEFAULT_PATHS

  const liveRequested = /(live|right now|in[- ]game|mid[- ]game|froms+(?:q[1-4]|quarter|half|inning|period|round|set|game))/i.test(activeTask)

  return {
    matched: true,
    pathCount,
    liveRequested,
    rawRequest: activeTask,
  }
}

export async function handleAskSportsSimulationCommand(
  input: { userId: string; activeTask: string },
  overrides: AskSportsSimulationOverrides = {},
): Promise<AskSportsSimulationResult | null> {
  const intent = inspectAskSportsSimulationIntent(input.activeTask)
  if (!intent) return null

  const now = overrides.now ?? (() => new Date())
  const context = overrides.suppliedContext
    ?? (overrides.provider ?? createProductionSportsSimulationContextProvider()).resolve
      ? await (overrides.provider ?? createProductionSportsSimulationContextProvider()).resolve({
          userId: input.userId,
          activeTask: input.activeTask,
          intent,
        })
      : null

  if (!context) {
    const proposal: DecisionProposal = {
      id: `ask-sports-sim:${crypto.randomUUID()}`,
      contextId: `sports-sim-context:${crypto.randomUUID()}`,
      disposition: "ASK",
      recommendation:
        "I recognized the simulation request, but I do not have an admitted point-in-time game context for it yet. Load/select the game in Sports, connect the sports context provider, or supply the game/player context; I will not invent team strength, player usage, injuries, or live state.",
      rationale:
        "SPORT-SIM only runs on admitted point-in-time inputs. Missing provider context fails closed rather than substituting guessed sports data.",
      evidence: [],
      uncertainty: [
        "No canonical Sports simulation context was resolved for this request.",
        "No simulation statistics were generated.",
      ],
      alternatives: [
        "Open the game in the Sports workstation and ask Jhadina to simulate this game.",
        "Provide a point-in-time game/player context for a hypothetical stress test.",
      ],
    }
    return {
      proposal,
      workPlan: {
        kind: "sports_simulation",
        authority: "SIMULATION_ONLY",
        nextBoundary: "sports_simulation",
        pathCount: intent.pathCount,
        liveRequested: intent.liveRequested,
        contextStatus: "MISSING",
        notes: [
          "No synthetic team/player strengths were substituted.",
          "No betting or financial authority was created.",
        ],
      },
      verified: true,
      verificationReason: "Sports simulation intent was resolved, but no admitted game context was available; execution failed closed.",
    }
  }

  assertResolvedContext(context)
  const seed = [
    "ask-jhadina",
    context.eventId,
    context.observedAt,
    context.contextId,
    String(intent.pathCount),
    intent.liveRequested ? "live" : "pregame",
  ].join("|")

  const simulation = runCorrelatedSportsMonteCarlo({
    eventId: context.eventId,
    sport: context.sport,
    currentHomeScore: context.currentHomeScore,
    currentAwayScore: context.currentAwayScore,
    pathCount: intent.pathCount,
    randomSeed: seed,
    teamModels: context.teamModels,
    playerModels: context.playerModels,
    latentFactors: context.latentFactors,
    marketLegs: context.marketLegs,
    jointSets: context.jointSets,
    heavyTailRegimeBps: context.heavyTailRegimeBps,
  })

  const report = buildSportsSimulationReport({
    eventLabel: context.eventLabel,
    simulation,
    requestedStats: context.requestedStats,
    assumptions: context.assumptions,
    scenarioNotes: context.scenarioNotes,
    warnings: [
      ...context.warnings,
      intent.liveRequested
        ? "Live simulation quality depends on the freshness of the admitted game-state snapshot."
        : "Pregame simulation uses the admitted information cutoff; later lineup/injury news is not backfilled into this run.",
    ],
  })

  const observedAt = now().toISOString()
  const evidence: EvidenceRef[] = context.evidenceIds.map((id) => ({
    id,
    source: context.source === "USER_SUPPLIED_CONTEXT" ? "user-supplied-sports-context" : "sports-simulation-context",
    observedAt: context.observedAt,
    summary: `SPORT-SIM input for ${context.eventLabel}; contextId=${context.contextId}`,
    immutable: context.source === "ADMITTED_SPORTS_CONTEXT",
  }))

  const proposal: DecisionProposal = {
    id: `ask-sports-sim:${crypto.randomUUID()}`,
    contextId: `sports-sim-context:${context.contextId}`,
    disposition: "PROCEED",
    recommendation: renderSportsSimulationReportText(report),
    rationale:
      `Jhadina ran ${intent.pathCount.toLocaleString()} correlated SPORT-SIM paths against the resolved point-in-time context for ${context.eventLabel}. The result is probabilistic intelligence only and preserves the exact simulation ID, seed, assumptions, and evidence lineage.`,
    evidence,
    uncertainty: [
      ...report.warnings,
      `Simulation context observed at ${context.observedAt}; response created at ${observedAt}.`,
    ],
    alternatives: [
      "Change one or more scenario assumptions/sliders and run a revision.",
      "Request a narrower player-stat or market-specific simulation.",
    ],
  }

  return {
    proposal,
    report,
    workPlan: {
      kind: "sports_simulation",
      authority: "SIMULATION_ONLY",
      nextBoundary: "sports_simulation",
      pathCount: intent.pathCount,
      liveRequested: intent.liveRequested,
      contextStatus: "RESOLVED",
      eventId: context.eventId,
      eventLabel: context.eventLabel,
      notes: [
        "Simulation output is intelligence only.",
        "No wager, prediction-market order, payment, or financial action was created.",
        "Re-running with changed assumptions produces a new simulation rather than rewriting the prior run.",
      ],
    },
    verified: true,
    verificationReason: "SPORT-SIM completed from a resolved point-in-time context and returned a non-executable simulation report.",
  }
}

export function createProductionSportsSimulationContextProvider(): SportsSimulationContextProvider {
  return {
    async resolve(input) {
      const url = process.env.SPORTS_SIMULATION_CONTEXT_URL?.trim()
      if (!url) return null
      const token = process.env.SPORTS_SIMULATION_CONTEXT_TOKEN?.trim()
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: input.userId,
          query: input.activeTask,
          pathCount: input.intent.pathCount,
          liveRequested: input.intent.liveRequested,
        }),
        cache: "no-store",
      })
      if (!response.ok) return null
      return parseSportsSimulationResolvedContext(await response.json(), "ADMITTED_SPORTS_CONTEXT")
    },
  }
}

export function parseSportsSimulationResolvedContext(
  value: unknown,
  source: SportsSimulationResolvedContext["source"],
): SportsSimulationResolvedContext {
  if (!value || typeof value !== "object") throw new Error("SPORT_SIM_CONTEXT_INVALID")
  const v = value as Record<string, unknown>
  const text = (key: string) => typeof v[key] === "string" ? (v[key] as string).trim() : ""
  const num = (key: string) => typeof v[key] === "number" && Number.isFinite(v[key]) ? v[key] as number : Number.NaN
  const array = (key: string) => Array.isArray(v[key]) ? v[key] as unknown[] : []
  const sport = text("sport") as SportsSimSport
  if (!["FOOTBALL","BASKETBALL","BASEBALL","HOCKEY","TENNIS","BOXING","SOCCER"].includes(sport)) throw new Error("SPORT_SIM_CONTEXT_SPORT_INVALID")

  const result: SportsSimulationResolvedContext = {
    contextId: text("contextId"),
    eventId: text("eventId"),
    eventLabel: text("eventLabel"),
    sport,
    observedAt: text("observedAt"),
    currentHomeScore: num("currentHomeScore"),
    currentAwayScore: num("currentAwayScore"),
    teamModels: array("teamModels") as unknown as readonly SportsTeamScoreModel[],
    playerModels: array("playerModels") as unknown as readonly SportsPlayerStatModel[],
    latentFactors: array("latentFactors") as unknown as readonly SportsLatentFactor[],
    marketLegs: array("marketLegs") as unknown as readonly SportsSimMarketLeg[],
    jointSets: array("jointSets") as unknown as SportsSimulationResolvedContext["jointSets"],
    heavyTailRegimeBps: num("heavyTailRegimeBps"),
    requestedStats: array("requestedStats") as unknown as readonly SportsSimulationRequestedStat[],
    assumptions: array("assumptions").filter((x): x is string => typeof x === "string"),
    scenarioNotes: array("scenarioNotes").filter((x): x is string => typeof x === "string"),
    warnings: array("warnings").filter((x): x is string => typeof x === "string"),
    evidenceIds: array("evidenceIds").filter((x): x is string => typeof x === "string" && Boolean(x.trim())),
    source,
  }
  assertResolvedContext(result)
  return result
}

function assertResolvedContext(c: SportsSimulationResolvedContext): void {
  if (!c.contextId || !c.eventId || !c.eventLabel || !c.evidenceIds.length) throw new Error("SPORT_SIM_CONTEXT_LINEAGE_REQUIRED")
  if (Number.isNaN(Date.parse(c.observedAt))) throw new Error("SPORT_SIM_CONTEXT_TIME_INVALID")
  if (!Number.isFinite(c.currentHomeScore) || !Number.isFinite(c.currentAwayScore)) throw new Error("SPORT_SIM_CONTEXT_SCORE_INVALID")
  if (c.teamModels.length !== 2) throw new Error("SPORT_SIM_CONTEXT_TEAM_MODELS_REQUIRED")
  if (!Number.isInteger(c.heavyTailRegimeBps) || c.heavyTailRegimeBps < 0 || c.heavyTailRegimeBps > 5000) throw new Error("SPORT_SIM_CONTEXT_TAIL_INVALID")
  if (c.requestedStats.some((s) => !s.statId.trim() || !s.label.trim())) throw new Error("SPORT_SIM_CONTEXT_REQUESTED_STAT_INVALID")
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/s+/g, " ").trim()
}
