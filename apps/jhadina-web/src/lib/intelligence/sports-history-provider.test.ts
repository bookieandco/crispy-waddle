import { describe, expect, it } from "vitest"
import { createProductionSportsHistoryProvider } from "./sports-history-provider"

const responseBody={
  entity:{kind:"PLAYER",id:"sportsdataverse:nba:athlete:1",providerId:"1",label:"Test Player",league:"nba"},
  providerClaimsAllTimeCoverage:true,
  warnings:["provider warning"],
  records:[{
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
    phase:"REGULAR",
    statKey:"offense.points",
    statLabel:"points",
    value:30,
    observedAt:"2026-09-27T19:00:00Z",
    availableAt:"2026-09-27T19:00:00Z",
    sourceProvider:"sportsdataverse/espn",
    sourceClass:"PRIMARY_API",
    evidenceIds:["e1"],
    authority:"HISTORICAL_EVIDENCE_ONLY",
    canExecute:false,
  }],
}

describe("Sports history production provider",()=>{
  it("posts a bounded read-only request and builds the canonical history view",async()=>{
    let seenUrl=""
    let seenInit:RequestInit|undefined
    const provider=createProductionSportsHistoryProvider({
      baseUrl:"https://history.internal/history/query",
      token:"secret",
      fetchImpl:async(input,init)=>{
        seenUrl=String(input)
        seenInit=init
        return new Response(JSON.stringify(responseBody),{
          status:200,
          headers:{"content-type":"application/json"},
        })
      },
    })
    const view=await provider.query({
      rawQuery:"Test Player NBA all-time points",
      league:"nba",
      scopes:[{kind:"ALL_TIME"}],
      statKeys:["points"],
      asOf:"2026-09-27T20:00:00Z",
    })
    expect(seenUrl).toBe("https://history.internal/history/query")
    expect(seenInit?.method).toBe("POST")
    expect((seenInit?.headers as Record<string,string>).authorization).toBe("Bearer secret")
    expect(JSON.parse(String(seenInit?.body))).toMatchObject({
      query:"Test Player NBA all-time points",
      league:"nba",
      statKeys:["points"],
      maxSeasons:60,
      maxRecords:100000,
    })
    expect(view?.allTimeAvailable).toBe(true)
    expect(view?.records).toHaveLength(1)
    expect(view?.summaries[0]?.statKey).toBe("offense.points")
    expect(view?.authority).toBe("HISTORICAL_EVIDENCE_ONLY")
    expect(view?.predictiveAuthority).toBe("NONE")
    expect(view?.bettingAuthority).toBe("NONE")
    expect(view?.canExecute).toBe(false)
  })

  it("does not count NBA playoff points as regular-season all-time points",async()=>{
    const playoff={...responseBody.records[0],recordId:"playoff",eventId:"game-playoff",phase:"PLAYOFFS",value:999}
    const provider=createProductionSportsHistoryProvider({
      baseUrl:"https://history.internal/history/query",
      fetchImpl:async()=>new Response(JSON.stringify({...responseBody,records:[...responseBody.records,playoff]}),{status:200}),
    })
    const view=await provider.query({
      rawQuery:"LeBron James NBA all-time points",league:"nba",
      scopes:[{kind:"ALL_TIME"}],statKeys:["points"],asOf:"2026-09-27T20:00:00Z",
    })
    expect(view?.records).toHaveLength(1)
    expect(view?.summaries[0]?.sum).toBe(30)
    expect(view?.warnings.join(" ")).toMatch(/playoffs are excluded/i)
  })

  it("does not certify unknown-phase NBA data as a complete career",async()=>{
    const unknown={...responseBody.records[0],phase:"UNKNOWN",recordId:"unknown"}
    const provider=createProductionSportsHistoryProvider({
      baseUrl:"https://history.internal/history/query",
      fetchImpl:async()=>new Response(JSON.stringify({...responseBody,records:[unknown]}),{status:200}),
    })
    const view=await provider.query({
      rawQuery:"LeBron James NBA all-time points",league:"nba",
      scopes:[{kind:"ALL_TIME"}],statKeys:["points"],asOf:"2026-09-27T20:00:00Z",
    })
    expect(view?.allTimeAvailable).toBe(false)
    expect(view?.warnings.join(" ")).toMatch(/unknown game phase/i)
  })

  it("sends the protection bypass only to a configured HTTPS Vercel history host",async()=>{
    let observed:RequestInit|undefined
    const provider=createProductionSportsHistoryProvider({
      baseUrl:"https://jhadina-sports-history-private.vercel.app/history/query",
      token:"history-token",
      vercelBypassSecret:"private-bypass",
      fetchImpl:async(_url,init)=>{
        observed=init
        return new Response(JSON.stringify(responseBody),{status:200})
      },
    })
    await provider.query({
      rawQuery:"Test Player NBA all-time points",
      league:"nba",scopes:[{kind:"ALL_TIME"}],statKeys:["points"],
      asOf:"2026-09-27T20:00:00Z",
    })
    expect(observed?.headers).toMatchObject({
      authorization:"Bearer history-token",
      "x-vercel-protection-bypass":"private-bypass",
    })
  })

  it("refuses to leak a Vercel bypass token to a non-Vercel host",async()=>{
    const provider=createProductionSportsHistoryProvider({
      baseUrl:"https://history.attacker.example/history/query",
      vercelBypassSecret:"private-bypass",
      fetchImpl:async()=>{throw new Error("must not contact unsafe destination")},
    })
    await expect(provider.query({
      rawQuery:"Test Player NBA all-time points",
      league:"nba",scopes:[{kind:"ALL_TIME"}],statKeys:["points"],
      asOf:"2026-09-27T20:00:00Z",
    })).rejects.toThrow("SPORT_HISTORY_PROVIDER_BYPASS_TARGET_FORBIDDEN")
  })

  it("fails closed for unresolved/not-admissible provider responses",async()=>{
    const provider=createProductionSportsHistoryProvider({
      baseUrl:"https://history.internal/history/query",
      fetchImpl:async()=>new Response(JSON.stringify({detail:"not found"}),{status:404}),
    })
    await expect(provider.query({
      rawQuery:"Unknown NBA career stats",
      league:"nba",
      scopes:[{kind:"CAREER"}],
      statKeys:[],
      asOf:"2026-09-27T20:00:00Z",
    })).resolves.toBeNull()
  })

  it("does not invent a production provider when SPORTS_HISTORY_URL is absent",async()=>{
    const provider=createProductionSportsHistoryProvider({
      baseUrl:"",
      fetchImpl:async()=>{throw new Error("should not fetch")},
    })
    await expect(provider.query({
      rawQuery:"Test Player NBA career stats",
      league:"nba",
      scopes:[{kind:"CAREER"}],
      statKeys:[],
      asOf:"2026-09-27T20:00:00Z",
    })).resolves.toBeNull()
  })
})
