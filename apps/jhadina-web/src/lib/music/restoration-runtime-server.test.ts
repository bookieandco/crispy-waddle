import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../vercel-oidc-runtime",()=>({currentVercelOidcToken:vi.fn()}));

import { currentVercelOidcToken } from "../vercel-oidc-runtime";
import {
  getMusicRestorationRuntimeHealth,
  isMusicRestorationRuntimeConfigured,
  musicRestorationRuntimeAuthMode,
  musicRestorationRuntimeSource,
} from "./restoration-runtime-server";

const keys=[
  "MUSIC_RESTORATION_WORKER_URL",
  "MUSIC_RESTORATION_WORKER_TOKEN",
  "VERCEL_OIDC_TOKEN",
  "DIRECTOR_HUNYUAN_WORKER_URL",
  "DIRECTOR_HUNYUAN_WORKER_TOKEN",
] as const;
const original=Object.fromEntries(keys.map(key=>[key,process.env[key]]));

describe("Music restoration runtime server binding",()=>{
  beforeEach(()=>{
    for(const key of keys) delete process.env[key];
    vi.mocked(currentVercelOidcToken).mockReset();
    vi.mocked(currentVercelOidcToken).mockResolvedValue("");
  });

  afterEach(()=>{
    vi.restoreAllMocks();
    for(const key of keys){
      const value=original[key];
      if(value===undefined) delete process.env[key];
      else process.env[key]=value;
    }
  });

  it("discovers the admitted replacement GPU runtime through SWLC",async()=>{
    vi.mocked(currentVercelOidcToken).mockResolvedValue("oidc-production-token");
    const discovery=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({
      ok:true,
      configured:true,
      baseUrl:"https://replacement123-8091.proxy.runpod.net/",
      staticTokenConfigured:false,
      authority:"DIRECTOR_HUNYUAN_RUNTIME_BINDING_URL_ONLY",
    }),{
      status:200,
      headers:{"content-type":"application/json"},
    }));
    const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      expect(String(input)).toBe(
        "https://replacement123-8091.proxy.runpod.net/music-restoration/health",
      );
      expect(new Headers(init?.headers).get("authorization"))
        .toBe("Bearer oidc-production-token");
      return new Response(JSON.stringify({status:"ready",productionReady:true}),{
        status:200,
        headers:{"content-type":"application/json"},
      });
    }) as unknown as typeof fetch;

    await expect(isMusicRestorationRuntimeConfigured()).resolves.toBe(true);
    await expect(musicRestorationRuntimeAuthMode()).resolves.toBe("vercel-oidc");
    await expect(musicRestorationRuntimeSource()).resolves.toBe("swlc-runtime-binding");
    await expect(getMusicRestorationRuntimeHealth(fetcher)).resolves.toEqual({
      status:"ready",
      productionReady:true,
    });
    expect(discovery).toHaveBeenCalledWith(
      "https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway",
      expect.objectContaining({
        method:"POST",
        headers:expect.objectContaining({authorization:"Bearer oidc-production-token"}),
      }),
    );
  });

  it("rejects a non-RunPod SWLC binding and falls back to the legacy proxy",async()=>{
    vi.mocked(currentVercelOidcToken).mockResolvedValue("oidc-production-token");
    vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({
      ok:true,
      configured:true,
      baseUrl:"https://evil.example/worker",
    }),{
      status:200,
      headers:{"content-type":"application/json"},
    }));
    const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
      expect(String(input)).toBe(
        "https://xn73vwwekavcc6-8091.proxy.runpod.net/music-restoration/health",
      );
      return new Response(JSON.stringify({status:"blocked",productionReady:false}),{
        status:200,
        headers:{"content-type":"application/json"},
      });
    }) as unknown as typeof fetch;

    await expect(musicRestorationRuntimeSource()).resolves.toBe("legacy-default");
    await expect(getMusicRestorationRuntimeHealth(fetcher)).resolves.toMatchObject({
      productionReady:false,
    });
  });

  it("reuses the commissioned Hunyuan proxy and token when Music-specific env is absent",async()=>{
    process.env.DIRECTOR_HUNYUAN_WORKER_URL="https://shared-pod.example";
    process.env.DIRECTOR_HUNYUAN_WORKER_TOKEN="shared-hunyuan-token";

    const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      expect(String(input)).toBe("https://shared-pod.example/music-restoration/health");
      expect(new Headers(init?.headers).get("authorization"))
        .toBe("Bearer shared-hunyuan-token");
      return new Response(JSON.stringify({status:"ready",productionReady:true}),{
        status:200,
        headers:{"content-type":"application/json"},
      });
    }) as unknown as typeof fetch;

    await expect(isMusicRestorationRuntimeConfigured()).resolves.toBe(true);
    await expect(musicRestorationRuntimeAuthMode()).resolves.toBe("shared-hunyuan");
    await expect(musicRestorationRuntimeSource()).resolves.toBe("director-environment");
    await expect(getMusicRestorationRuntimeHealth(fetcher)).resolves.toEqual({
      status:"ready",
      productionReady:true,
    });
  });

  it("keeps an explicit static worker token as the higher-priority fallback",async()=>{
    process.env.VERCEL_OIDC_TOKEN="oidc-production-token";
    process.env.MUSIC_RESTORATION_WORKER_TOKEN="static-worker-token";
    process.env.MUSIC_RESTORATION_WORKER_URL="https://worker.example";
    await expect(isMusicRestorationRuntimeConfigured()).resolves.toBe(true);
    await expect(musicRestorationRuntimeAuthMode()).resolves.toBe("static");
    await expect(musicRestorationRuntimeSource()).resolves.toBe("music-environment");
  });

  it("fails closed outside Vercel when neither OIDC nor a static token exists",async()=>{
    await expect(isMusicRestorationRuntimeConfigured()).resolves.toBe(false);
    await expect(musicRestorationRuntimeAuthMode()).resolves.toBe("unconfigured");
    await expect(musicRestorationRuntimeSource()).resolves.toBe("unconfigured");
  });
});
