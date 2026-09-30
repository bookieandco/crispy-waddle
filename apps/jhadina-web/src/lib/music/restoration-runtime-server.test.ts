import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({
  createClient:vi.fn(),
}));

vi.mock("../supabase/server",()=>({
  createClient:mocks.createClient,
}));

import {
  createRequestMusicRestorationRuntimeClient,
  getMusicRestorationRuntimeHealth,
  getMusicRestorationRuntimeLiveness,
  isMusicRestorationRuntimeConfigured,
  musicRestorationRuntimeAuthMode,
} from "./restoration-runtime-server";

const keys=[
  "MUSIC_RESTORATION_WORKER_URL",
  "MUSIC_RESTORATION_WORKER_TOKEN",
  "VERCEL_OIDC_TOKEN",
] as const;
const original=Object.fromEntries(keys.map(key=>[key,process.env[key]]));

describe("Music restoration runtime server binding",()=>{
  beforeEach(()=>{
    mocks.createClient.mockReset();
    for(const key of keys) delete process.env[key];
  });

  afterEach(()=>{
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    for(const key of keys){
      const value=original[key];
      if(value===undefined) delete process.env[key];
      else process.env[key]=value;
    }
  });

  it("uses production Vercel OIDC with the existing RunPod 8091 proxy by default",async()=>{
    process.env.VERCEL_OIDC_TOKEN="oidc-production-token";
    const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      expect(String(input)).toBe(
        "https://xn73vwwekavcc6-8091.proxy.runpod.net/music-restoration/health",
      );
      expect(new Headers(init?.headers).get("authorization"))
        .toBe("Bearer oidc-production-token");
      return new Response(JSON.stringify({status:"blocked",productionReady:false}),{
        status:200,
        headers:{"content-type":"application/json"},
      });
    }) as unknown as typeof fetch;

    expect(isMusicRestorationRuntimeConfigured()).toBe(true);
    expect(musicRestorationRuntimeAuthMode()).toBe("vercel-oidc");
    await expect(getMusicRestorationRuntimeHealth(fetcher)).resolves.toEqual({
      status:"blocked",
      productionReady:false,
    });
  });

  it("keeps an explicit static worker token as the higher-priority fallback",()=>{
    process.env.VERCEL_OIDC_TOKEN="oidc-production-token";
    process.env.MUSIC_RESTORATION_WORKER_TOKEN="static-worker-token";
    process.env.MUSIC_RESTORATION_WORKER_URL="https://worker.example";
    expect(isMusicRestorationRuntimeConfigured()).toBe(true);
    expect(musicRestorationRuntimeAuthMode()).toBe("static");
  });

  it("creates a user-bound runtime from the verified Supabase request session",async()=>{
    const userId="123e4567-e89b-12d3-a456-426614174000";
    mocks.createClient.mockResolvedValue({
      auth:{
        getClaims:vi.fn().mockResolvedValue({
          data:{claims:{sub:userId,role:"authenticated"}},
          error:null,
        }),
        getSession:vi.fn().mockResolvedValue({
          data:{session:{access_token:"supabase-session-token",user:{id:userId}}},
          error:null,
        }),
      },
    });

    const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      expect(String(input)).toBe(
        "https://xn73vwwekavcc6-8091.proxy.runpod.net/music-restoration/v1/probe",
      );
      const headers=new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer supabase-session-token");
      expect(headers.get("x-jhadina-user-id")).toBe(userId);
      return new Response(JSON.stringify({
        sourceArtifactId:"source-1",
        sourceSha256:"a".repeat(64),
        codec:"pcm_s24le",
        sampleRate:48000,
        channels:2,
        sampleCount:48000,
        durationSeconds:1,
        bitDepth:24,
        lossless:true,
        runtimeReceiptId:"probe-session-1",
      }),{
        status:200,
        headers:{"content-type":"application/json"},
      });
    });
    vi.stubGlobal("fetch",fetcher);

    const client=await createRequestMusicRestorationRuntimeClient(userId);
    const receipt=await client.probe({
      artifactId:"source-1",
      uri:"https://kqbkaozfjubkjevdfvic.supabase.co/storage/v1/object/sign/example",
      sha256:"a".repeat(64),
      mimeType:"audio/wav",
    });
    expect(receipt.runtimeReceiptId).toBe("probe-session-1");
  });

  it("rejects a request session whose verified subject does not match the expected user",async()=>{
    const userId="123e4567-e89b-12d3-a456-426614174000";
    mocks.createClient.mockResolvedValue({
      auth:{
        getClaims:vi.fn().mockResolvedValue({
          data:{claims:{sub:"123e4567-e89b-12d3-a456-426614174001",role:"authenticated"}},
          error:null,
        }),
        getSession:vi.fn().mockResolvedValue({
          data:{session:{access_token:"supabase-session-token",user:{id:userId}}},
          error:null,
        }),
      },
    });
    await expect(createRequestMusicRestorationRuntimeClient(userId))
      .rejects.toThrow("MUSIC_RESTORATION_SUPABASE_SESSION_IDENTITY_MISMATCH");
  });

  it("reports unauthenticated worker liveness without treating it as compute authorization",async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({
      status:"live",
      service:"music-restoration-worker",
    }),{
      status:200,
      headers:{"content-type":"application/json"},
    })) as unknown as typeof fetch;
    await expect(getMusicRestorationRuntimeLiveness(fetcher)).resolves.toEqual({
      reachable:true,
      status:"live",
      service:"music-restoration-worker",
      httpStatus:200,
    });
    expect(isMusicRestorationRuntimeConfigured()).toBe(false);
    expect(musicRestorationRuntimeAuthMode()).toBe("unconfigured");
  });
});
