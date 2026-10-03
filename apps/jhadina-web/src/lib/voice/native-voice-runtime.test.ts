import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const currentVercelOidcToken=vi.fn(async()=>"")

vi.mock("@/lib/vercel-oidc-runtime",()=>({
  currentVercelOidcToken,
}))

describe("native Jhadina voice runtime discovery",()=>{
  beforeEach(()=>{
    vi.resetModules()
    vi.restoreAllMocks()
    currentVercelOidcToken.mockReset()
    currentVercelOidcToken.mockResolvedValue("")
    delete process.env.JHADINA_VOICE_URL
    delete process.env.JHADINA_VOICE_TOKEN
    delete process.env.JHADINA_VOICE_URL_PINNED
  })

  afterEach(()=>{
    delete process.env.JHADINA_VOICE_URL
    delete process.env.JHADINA_VOICE_TOKEN
    delete process.env.JHADINA_VOICE_URL_PINNED
  })

  it("uses an explicitly pinned server runtime without discovery",async()=>{
    process.env.JHADINA_VOICE_URL="https://voice.internal"
    process.env.JHADINA_VOICE_TOKEN="secret"
    process.env.JHADINA_VOICE_URL_PINNED="true"
    const {nativeJhadinaVoiceRuntimeConfig}=await import("./native-voice-runtime")
    await expect(nativeJhadinaVoiceRuntimeConfig()).resolves.toEqual({
      baseUrl:"https://voice.internal",
      token:"secret",
      source:"environment",
    })
    expect(currentVercelOidcToken).not.toHaveBeenCalled()
  })

  it("discovers an admitted RunPod voice runtime through Vercel OIDC",async()=>{
    currentVercelOidcToken.mockResolvedValue("oidc-token")
    const upstream=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({
      configured:true,
      baseUrl:"https://pod123-8095.proxy.runpod.net",
      token:"runtime-secret",
    }),{status:200,headers:{"content-type":"application/json"}}))
    const {nativeJhadinaVoiceRuntimeConfig}=await import("./native-voice-runtime")
    await expect(nativeJhadinaVoiceRuntimeConfig()).resolves.toEqual({
      baseUrl:"https://pod123-8095.proxy.runpod.net",
      token:"runtime-secret",
      source:"swlc-runtime-binding",
    })
    expect(upstream).toHaveBeenCalledWith(
      expect.stringContaining("jhadina-director-bonez-gateway"),
      expect.objectContaining({
        method:"POST",
        body:JSON.stringify({action:"jhadina-voice-runtime-binding"}),
      }),
    )
  })

  it("rejects a discovered non-RunPod or wrong-port endpoint and falls back to env",async()=>{
    process.env.JHADINA_VOICE_URL="https://voice.example"
    process.env.JHADINA_VOICE_TOKEN="fallback"
    currentVercelOidcToken.mockResolvedValue("oidc-token")
    vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({
      configured:true,
      baseUrl:"https://evil.example/voice",
      token:"stolen",
    }),{status:200,headers:{"content-type":"application/json"}}))
    const {nativeJhadinaVoiceRuntimeConfig}=await import("./native-voice-runtime")
    await expect(nativeJhadinaVoiceRuntimeConfig()).resolves.toEqual({
      baseUrl:"https://voice.example",
      token:"fallback",
      source:"environment",
    })
  })

  it("fails closed when neither discovery nor a complete env pair is available",async()=>{
    currentVercelOidcToken.mockResolvedValue("oidc-token")
    vi.spyOn(globalThis,"fetch").mockRejectedValue(new Error("gateway down"))
    const {nativeJhadinaVoiceRuntimeConfig}=await import("./native-voice-runtime")
    await expect(nativeJhadinaVoiceRuntimeConfig()).resolves.toBeUndefined()
  })
})
