import { describe, expect, it } from "vitest"
import {
  handleAskSportsSimulationCommand,
  inspectAskSportsSimulationIntent,
  type SportsSimulationResolvedContext,
} from "./ask-sports-simulation-command"

function context(): SportsSimulationResolvedContext {
  return {
    contextId: "ctx:chiefs-bills",
    eventId: "nfl:chiefs-bills",
    eventLabel: "Chiefs vs Bills",
    sport: "FOOTBALL",
    observedAt: "2026-09-27T18:00:00Z",
    currentHomeScore: 0,
    currentAwayScore: 0,
    teamModels: [
      { team: "HOME", baseRemainingMean: 27, residualStdDev: 5, sensitivities: { GAME_SCRIPT_PASS: 2 } },
      { team: "AWAY", baseRemainingMean: 24, residualStdDev: 5, sensitivities: { GAME_SCRIPT_PASS: 2 } },
    ],
    playerModels: [
      {
        statId: "mahomes-pass-yards",
        playerId: "patrick-mahomes",
        baseRemainingMean: 272,
        residualStdDev: 42,
        minimum: 0,
        sensitivities: { GAME_SCRIPT_PASS: 45 },
        tailThresholds: [250, 300],
      },
      {
        statId: "allen-rush-yards",
        playerId: "josh-allen",
        baseRemainingMean: 41,
        residualStdDev: 18,
        minimum: 0,
        sensitivities: { GAME_SCRIPT_PASS: -5 },
        tailThresholds: [35, 50],
      },
    ],
    latentFactors: [
      { factorId: "GAME_SCRIPT_PASS", mean: 0.25, stdDev: 0.45, evidenceIds: ["game-script:e1"] },
    ],
    marketLegs: [
      { legId: "home-ml", kind: "HOME_WIN" },
      { legId: "over-49.5", kind: "TOTAL_OVER", line: 49.5 },
      { legId: "mahomes-250", kind: "PLAYER_OVER", statId: "mahomes-pass-yards", line: 250 },
    ],
    jointSets: [{ jointId: "sgp:home-over-mahomes", legIds: ["home-ml", "over-49.5", "mahomes-250"] }],
    heavyTailRegimeBps: 600,
    requestedStats: [
      { statId: "mahomes-pass-yards", label: "Mahomes passing yards" },
      { statId: "allen-rush-yards", label: "Allen rushing yards" },
    ],
    assumptions: ["Pregame state", "No late injury update after the context timestamp"],
    scenarioNotes: ["Baseline admitted context"],
    warnings: [],
    evidenceIds: ["context:e1", "roster:e1", "market:e1"],
    source: "ADMITTED_SPORTS_CONTEXT",
  }
}

describe("Ask Jhadina sports simulation shortcut", () => {
  it("parses requested simulation count and live mode", () => {
    const intent = inspectAskSportsSimulationIntent(
      "Jhadina simulate Chiefs vs Bills 25,000 times live from Q3 and show me the stats",
    )
    expect(intent?.pathCount).toBe(25_000)
    expect(intent?.liveRequested).toBe(true)
  })

  it("fails closed instead of inventing sports inputs when context is missing", async () => {
    const result = await handleAskSportsSimulationCommand(
      { userId: "u1", activeTask: "simulate Chiefs vs Bills 10,000 times" },
      { provider: { resolve: async () => null } },
    )
    expect(result?.proposal.disposition).toBe("ASK")
    expect(result?.report).toBeUndefined()
    expect(result?.workPlan.contextStatus).toBe("MISSING")
    expect(result?.proposal.recommendation).toContain("I will not invent")
  })

  it("runs correlated SPORT-SIM and returns score/player/market statistics from supplied context", async () => {
    const result = await handleAskSportsSimulationCommand(
      {
        userId: "u1",
        activeTask:
          "simulate Chiefs vs Bills 2,500 times and show Mahomes passing, Allen rushing, win probability, total and correlated scenarios",
      },
      {
        suppliedContext: context(),
        now: () => new Date("2026-09-27T18:00:30Z"),
      },
    )
    expect(result?.proposal.disposition).toBe("PROCEED")
    expect(result?.report?.pathCount).toBe(2_500)
    expect(result?.report?.requestedPlayerStats).toHaveLength(2)
    expect(result?.report?.marketProbabilities).toHaveLength(3)
    expect(result?.report?.jointProbabilities).toHaveLength(1)
    expect(result?.report?.bettingAuthority).toBe("NONE")
    expect(result?.report?.financialAuthority).toBe("NONE")
    expect(result?.report?.canExecute).toBe(false)
    expect(result?.proposal.recommendation).toContain("Chiefs vs Bills")
    expect(result?.proposal.recommendation).toContain("Mahomes passing yards")
  })
})
