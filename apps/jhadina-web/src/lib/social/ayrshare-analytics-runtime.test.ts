import {describe,expect,it,vi} from "vitest"
import {
  AyrshareProvider,
  type SocialObservation,
  type SocialOutboxJob,
} from "@jhadina/social-core"
import type {JhadinaIdentityVerifier} from "../auth/supabase-identity-verifier"
import type {SocialRepository} from "./repository"
import {
  ingestAyrshareDeliveredAnalytics,
  ingestAyrsharePostAnalytics,
} from "./ayrshare-analytics-runtime"

const identityVerifier:JhadinaIdentityVerifier={
  async verify(){return{userId:"user-1",sessionId:"session-1"}},
}

function deliveredJob(overrides:Partial<SocialOutboxJob>={}):SocialOutboxJob{
  return{
    id:"outbox-1",
    proposalId:"proposal-1",
    userId:"user-1",
    actionId:"action-1",
    target:{
      accountId:"account-1",
      brand:"jhadinatv",
      provider:"ayrshare",
      providerProfileId:"youtube-main",
      platform:"youtube",
    },
    text:"Test post",
    mediaUrls:[],
    status:"delivered",
    idempotencyKey:"idem-1",
    attemptCount:1,
    providerPostId:"ayr-post-1",
    createdAt:"2026-10-04T00:00:00.000Z",
    updatedAt:"2026-10-04T00:05:00.000Z",
    ...overrides,
  }
}

function fixture(jobs:SocialOutboxJob[]=[deliveredJob()]){
  const observations:SocialObservation[]=[]
  const repository={
    async listOutbox(userId:string,proposalId?:string){
      return jobs.filter(job=>job.userId===userId&&(!proposalId||job.proposalId===proposalId))
    },
    async recordObservation(input:any){
      const observation:SocialObservation={
        id:`observation-${observations.length+1}`,
        userId:input.userId,
        proposalId:input.proposalId,
        outboxId:input.outboxId,
        ...input.observation,
      }
      observations.push(observation)
      return observation
    },
  } as unknown as SocialRepository

  const fetcher=vi.fn(async(url:string|URL|Request,init?:RequestInit)=>{
    expect(String(url)).toContain("/analytics/post")
    expect((init?.headers as Record<string,string>)["Profile-Key"]).toBe("profile-secret")
    return new Response(JSON.stringify({
      youtube:{
        id:"ayr-post-1",
        postUrl:"https://youtube.example/watch?v=1",
        analytics:{
          impressionsCount:5000,
          videoViews:3200,
          likeCount:100,
          commentsCount:20,
          shareCount:5,
        },
      },
    }),{status:200,headers:{"content-type":"application/json"}})
  }) as typeof fetch

  const provider=new AyrshareProvider({
    apiKey:"api-key",
    fetcher,
    bindings:[{
      id:"youtube-main",
      profileKey:"profile-secret",
      platform:"youtube",
      name:"JhadinaTV",
    }],
  })

  return{
    repository,
    observations,
    providerFactory:async()=>provider,
    fetcher,
  }
}

describe("Ayrshare analytics runtime",()=>{
  it("persists provider-native performance and projects it into Growth learning",async()=>{
    const f=fixture()
    const result=await ingestAyrsharePostAnalytics("outbox-1",{
      identityVerifier,
      repository:f.repository,
      providerFactory:f.providerFactory,
    })
    expect(result.authority).toBe("OBSERVATION_ONLY")
    expect(result.externalActionAuthorized).toBe(false)
    expect(result.publishingAuthorized).toBe(false)
    expect(result.observation).toMatchObject({
      kind:"performance",
      source:"provider:ayrshare",
      provider:"ayrshare",
      platform:"youtube",
      accountId:"account-1",
      contentId:"ayr-post-1",
      sourceUrl:"https://youtube.example/watch?v=1",
      metrics:{
        impressions:5000,
        views:3200,
        engagements:125,
      },
      attributes:{provenance:"provider_native"},
    })
    expect(result.learning?.creativeSignal.contentId).toBe("ayr-post-1")
    expect(result.learning?.attributionEvents.some(event=>event.type==="impression")).toBe(true)
    expect(result.learning?.attributionEvents.some(event=>event.type==="view")).toBe(true)
    expect(result.learning?.attributionEvents.some(event=>event.type==="purchase")).toBe(false)
  })

  it("refuses analytics for undelivered or non-Ayrshare jobs",async()=>{
    const pending=fixture([deliveredJob({status:"pending"})])
    await expect(ingestAyrsharePostAnalytics("outbox-1",{
      identityVerifier,
      repository:pending.repository,
      providerFactory:pending.providerFactory,
    })).rejects.toThrow("AYRSHARE_ANALYTICS_REQUIRES_DELIVERED_OUTBOX")

    const wrong=fixture([deliveredJob({
      target:{...deliveredJob().target,provider:"hootsuite"},
    })])
    await expect(ingestAyrsharePostAnalytics("outbox-1",{
      identityVerifier,
      repository:wrong.repository,
      providerFactory:wrong.providerFactory,
    })).rejects.toThrow("AYRSHARE_OUTBOX_REQUIRED")
  })

  it("batch-ingests eligible deliveries and contains per-job failures",async()=>{
    const f=fixture([
      deliveredJob(),
      deliveredJob({id:"outbox-2",providerPostId:"ayr-post-2"}),
    ])
    let calls=0
    const result=await ingestAyrshareDeliveredAnalytics({limit:10},{
      identityVerifier,
      repository:f.repository,
      providerFactory:async()=>{
        calls+=1
        if(calls===2)throw new Error("synthetic provider outage")
        return await f.providerFactory()
      },
    })
    expect(result.attempted).toBe(2)
    expect(result.ingested).toHaveLength(1)
    expect(result.failures).toEqual([{outboxId:"outbox-2",error:"synthetic provider outage"}])
    expect(result.externalActionAuthorized).toBe(false)
    expect(result.publishingAuthorized).toBe(false)
  })
})
