import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../vercel-oidc-runtime",()=>({currentVercelOidcToken:vi.fn()}));

import { currentVercelOidcToken } from "../vercel-oidc-runtime";
import {
  getMusicRestorationRuntimeHealth,
  isMusicRestorationRuntimeConfigured,
  musicRestorationRuntimeAuthMode,
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

  it("uses production Vercel OIDC with the existing RunPod 8091 proxy by default",async()=>{
    vi.mocked(currentVercelOidcToken).mockResolvedValue("oidc-production-token");
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

    await expect(isMusicRestorationRuntimeConfigured()).resolves.toBe(true);
    await expect(musicRestorationRuntimeAuthMode()).resolves.toBe("vercel-oidc");
    await expect(getMusicRestorationRuntimeHealth(fetcher)).resolves.toEqual({
      status:"blocked",
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
  });

  it("fails closed outside Vercel when neither OIDC nor a static token exists",async()=>{
    await expect(isMusicRestorationRuntimeConfigured()).resolves.toBe(false);
    await expect(musicRestorationRuntimeAuthMode()).resolves.toBe("unconfigured");
  });
});
