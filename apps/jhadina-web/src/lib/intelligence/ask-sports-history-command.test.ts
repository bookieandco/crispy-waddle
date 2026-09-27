import { describe, expect, it } from "vitest"
import { buildSportsHistoryView, type SportsHistoricalStatRecord, type SportsHistoryView } from "@jhadina/money-core"
import {
  handleAskSportsHistoryCommand,
  inspectAskSportsHistoryIntent,
} from "./ask-sports-history-command"

const record:SportsHistoricalStatRecord=Object.freeze({
  recordId:"r1",
  entityKind:"PLAYER",
  entityId:"sportsdataverse:nba:athlete:1",
  entityLabel:"Test Player",
  sport:"NBA",
  competition:"NBA",
  season:"2026",
  eventId:"g1",
  eventDate:"2026-09-01T00:00:00Z",
  opponentLabel:"Denver Nuggets",
  venue:"HOME",
  phase:"PLAYOFFS",
  statKey:"offense.points",
  statLabel:"points",
  value:31,
  observedAt:"2026-09-27T19:00:00Z",
  availableAt:"2026-09-27T19:00:00Z",
  sourceProvider:"sportsdataverse/espn",
  sourceClass:"PRIMARY_API",
  evidenceIds:Object.freeze(["e1"]),
  authority:"HISTORICAL_EVIDENCE_ONLY",
  canExecute:false,
})

function view():SportsHistoryView{
  return buildSportsHistoryView({
    query:Object.freeze({
      queryId:"q1",
      entityKind:"PLAYER",
      entityId:record.entityId,
      competition:"NBA",
      statKeys:Object.freeze(["points"]),
      scopes:Object.freeze([{kind:"ALL_TIME" as const}]),
      asOf:"2026-09-27T20:00:00Z",
    }),
    records:[record],
    providerClaimsAllTimeCoverage:true,
  })
}

describe("Ask Jhadina sports history shortcut",()=>{
  it("parses all-time, last-N, playoffs, opponent and stat aliases",()=>{
    const intent=inspectAskSportsHistoryIntent(
      "Show me LeBron NBA all-time points last 20 playoffs vs Denver stats",
    )
    expect(intent?.league).toBe("nba")
    expect(intent?.statKeys).toContain("points")
    expect(intent?.scopes).toContainEqual({kind:"ALL_TIME"})
    expect(intent?.scopes).toContainEqual({kind:"LAST_N",count:20})
    expect(intent?.scopes).toContainEqual({kind:"PLAYOFFS"})
    expect(intent?.scopes).toContainEqual({kind:"VS_OPPONENT",opponentLabel:"Denver"})
  })

  it("fails closed when the league or historical provider cannot resolve the request",async()=>{
    const result=await handleAskSportsHistoryCommand(
      {userId:"u1",activeTask:"Show me this player's all-time stats"},
      {provider:{query:async()=>null},now:()=>new Date("2026-09-27T20:00:00Z")},
    )
    expect(result?.proposal.disposition).toBe("ASK")
    expect(result?.view).toBeUndefined()
    expect(result?.proposal.recommendation).toMatch(/league|provider/i)
  })

  it("renders canonical history while preserving zero execution and prediction authority",async()=>{
    const v=view()
    const result=await handleAskSportsHistoryCommand(
      {userId:"u1",activeTask:"Show me Test Player NBA all-time points"},
      {provider:{query:async()=>v},now:()=>new Date("2026-09-27T20:00:00Z")},
    )
    expect(result?.proposal.disposition).toBe("PROCEED")
    expect(result?.view?.allTimeAvailable).toBe(true)
    expect(result?.view?.predictiveAuthority).toBe("NONE")
    expect(result?.view?.bettingAuthority).toBe("NONE")
    expect(result?.view?.financialAuthority).toBe("NONE")
    expect(result?.view?.canExecute).toBe(false)
    expect(result?.proposal.recommendation).toContain("Test Player")
    expect(result?.proposal.recommendation).toContain("Complete all-time coverage certified: yes")
  })
})
