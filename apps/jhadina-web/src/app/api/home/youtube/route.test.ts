import {beforeEach,afterEach,describe,expect,it,vi} from "vitest"
import {NextRequest} from "next/server"
import {encryptSecret} from "@/lib/youtube-oauth"

const owner=vi.hoisted(()=>({id:"owner-one",authenticated:true}))
vi.mock("@/lib/auth/request-identity",()=>({
  createRequestIdentityVerifier:async()=>({
    verify:async()=>{if(!owner.authenticated)throw Error("auth failure must not leak");return {userId:owner.id}},
  }),
}))
import {GET} from "./route"

function req(cookies:Record<string,string>={}){
  return new NextRequest("https://jhadina.example/api/home/youtube",{
    headers:{cookie:Object.entries(cookies).map(([key,value])=>key+"="+encodeURIComponent(value)).join("; ")},
  })
}
const fakeChannel="UC0123456789012345678901"
const fakeVideo="aB12_cdEF34"
function upstream(){
  const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
    const url=new URL(String(input))
    if(url.pathname.endsWith("/subscriptions"))return Response.json({items:[{snippet:{resourceId:{channelId:fakeChannel}}}],pageInfo:{totalResults:1}})
    if(url.pathname.endsWith("/activities"))return Response.json({items:[{snippet:{type:"upload",title:"Actual upload",channelTitle:"Sample channel",publishedAt:"2026-10-17T18:00:00Z"},contentDetails:{upload:{videoId:fakeVideo}}}]})
    return new Response(null,{status:404})
  })
  vi.stubGlobal("fetch",fetcher)
  return fetcher
}
describe("Owner-scoped YouTube feed boundary",()=>{
  beforeEach(()=>{
    owner.id="owner-one"
    owner.authenticated=true
    process.env.JHADINA_OAUTH_ENCRYPTION_KEY="test-only-32-character-cookie-secret"
  })
  afterEach(()=>{vi.unstubAllGlobals();delete process.env.JHADINA_OAUTH_ENCRYPTION_KEY;delete process.env.GOOGLE_CLIENT_ID;delete process.env.GOOGLE_CLIENT_SECRET})
  it("does not call providers for anonymous requests",async()=>{
    const fetcher=upstream()
    owner.authenticated=false
    const result=await GET(req())
    expect(result.status).toBe(401)
    expect((await result.json()).items).toEqual([])
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("requires a voluntary connection",async()=>{
    const fetcher=upstream()
    const result=await GET(req())
    expect((await result.json()).connection).toBe("disconnected")
    expect(result.headers.get("cache-control")).toContain("no-store")
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("blocks another Jhadina owner before any YouTube request",async()=>{
    const fetcher=upstream()
    const cookies={jhadina_youtube_owner:encryptSecret("owner-two"),jhadina_youtube_access:encryptSecret("access-token")}
    const result=await GET(req(cookies))
    expect((await result.json()).connection).toBe("reauthorize")
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("reads only a bounded, attributed upload sample from authorized subscriptions",async()=>{
    const fetcher=upstream()
    const cookies={jhadina_youtube_owner:encryptSecret("owner-one"),jhadina_youtube_access:encryptSecret("access-token")}
    const result=await GET(req(cookies))
    const payload=await result.json()
    expect(payload.connection).toBe("connected")
    expect(payload.items).toEqual([expect.objectContaining({id:fakeVideo,url:"https://www.youtube.com/watch?v="+fakeVideo,channel:"Sample channel"})])
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(result.headers.get("cache-control")).toContain("no-store")
  })
  it("does not report the feed healthy if every subscribed-channel fetch fails",async()=>{
    vi.stubGlobal("fetch",vi.fn(async(input:RequestInfo|URL)=>{
      const uri=String(input)
      if(uri.includes("/subscriptions"))return Response.json({items:[{snippet:{resourceId:{channelId:fakeChannel}}}],pageInfo:{totalResults:1}})
      return new Response(null,{status:403})
    }))
    const result=await GET(req({jhadina_youtube_owner:encryptSecret("owner-one"),jhadina_youtube_access:encryptSecret("access-token")}))
    const data=await result.json()
    expect(data.connection).toBe("unavailable")
    expect(data.items).toEqual([])
  })
  it("never turns API failure into fake posts or successful link state",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response("quota exhausted",{status:403})))
    const result=await GET(req({jhadina_youtube_owner:encryptSecret("owner-one"),jhadina_youtube_access:encryptSecret("access-token")}))
    const payload=await result.json()
    expect(payload.connection).toBe("unavailable")
    expect(payload.items).toEqual([])
    expect(JSON.stringify(payload)).not.toContain("quota exhausted")
  })
  it("can refresh the owner's token without leaking the refresh credential to the response body",async()=>{
    process.env.GOOGLE_CLIENT_ID="fake-google-id"
    process.env.GOOGLE_CLIENT_SECRET="fake-google-secret"
    const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input)
      if(url==="https://oauth2.googleapis.com/token")return Response.json({access_token:"refreshed-access",expires_in:3600})
      if(url.includes("/subscriptions"))return Response.json({items:[]})
      return new Response(null,{status:404})
    })
    vi.stubGlobal("fetch",fetcher)
    const result=await GET(req({jhadina_youtube_owner:encryptSecret("owner-one"),jhadina_youtube_refresh:encryptSecret("refresh-private")}))
    const payload=await result.json()
    expect(payload.connection).toBe("connected")
    expect(result.cookies.get("jhadina_youtube_access")?.httpOnly).toBe(true)
    expect(JSON.stringify(payload)).not.toContain("refresh-private")
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
