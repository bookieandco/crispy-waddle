import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const verify=vi.fn(async()=>({userId:"user-1",sessionId:"session-1"}))

vi.mock("@/lib/auth/request-identity",()=>({
  createRequestIdentityVerifier:vi.fn(async()=>({verify})),
}))

describe("Jhadina voice HTTP bridge",()=>{
  beforeEach(()=>{
    vi.restoreAllMocks()
    verify.mockClear()
    process.env.JHADINA_VOICE_URL="https://voice.example"
    process.env.JHADINA_VOICE_TOKEN="secret"
  })

  it("reports browser fallback when native voice infrastructure is not configured",async()=>{
    delete process.env.JHADINA_VOICE_URL
    delete process.env.JHADINA_VOICE_TOKEN
    const {GET}=await import("./route")
    const req=new NextRequest("https://app.example/api/jhadina/voice/health",{
      method:"GET",
      headers:{"x-jhadina-user-id":"user-1"},
    })
    const response=await GET(req,{params:Promise.resolve({action:"health"})})
    const json=await response.json()
    expect(response.status).toBe(200)
    expect(json.native).toBe(false)
    expect(json.status).toBe("browser-fallback")
    expect(json.canonicalVoiceProfile).toBe("jhadina:canonical")
  })

  it("proxies progressive speak-stream without buffering",async()=>{
    const upstream=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(
      '{"type":"audio","index":0,"count":1,"audioBase64":"UklGRg==","mimeType":"audio/wav"}\n{"type":"done","count":1}\n',
      {status:200,headers:{"content-type":"application/x-ndjson"}},
    ))
    const {POST}=await import("./route")
    const req=new NextRequest("https://app.example/api/jhadina/voice/speak-stream",{
      method:"POST",
      headers:{"content-type":"application/json","x-jhadina-user-id":"user-1"},
      body:JSON.stringify({text:"hello",language:"en-US",voiceProfileId:"jhadina:canonical"}),
    })

    const response=await POST(req,{params:Promise.resolve({action:"speak-stream"})})
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("application/x-ndjson")
    expect(await response.text()).toContain('"type":"audio"')
    expect(upstream).toHaveBeenCalledWith(
      "https://voice.example/v1/speak-stream",
      expect.objectContaining({method:"POST"}),
    )
  })
})
