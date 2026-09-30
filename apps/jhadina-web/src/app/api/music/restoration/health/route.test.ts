import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({
  getHealth:vi.fn(),
  getLiveness:vi.fn(),
  isConfigured:vi.fn(),
  authMode:vi.fn(),
}));

vi.mock("@/lib/music/restoration-runtime-server",()=>({
  getMusicRestorationRuntimeHealth:mocks.getHealth,
  getMusicRestorationRuntimeLiveness:mocks.getLiveness,
  isMusicRestorationRuntimeConfigured:mocks.isConfigured,
  musicRestorationRuntimeAuthMode:mocks.authMode,
}));

import { GET } from "./route";

describe("Music restoration health route",()=>{
  beforeEach(()=>{
    mocks.getHealth.mockReset();
    mocks.getLiveness.mockReset();
    mocks.isConfigured.mockReset();
    mocks.authMode.mockReset();
  });

  it("reports reachable sidecar with interactive Supabase session auth when machine auth is absent",async()=>{
    mocks.isConfigured.mockReturnValue(false);
    mocks.authMode.mockReturnValue("unconfigured");
    mocks.getLiveness.mockResolvedValue({
      reachable:true,
      status:"live",
      service:"music-restoration-worker",
      httpStatus:200,
    });

    const response=await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok:true,
      configured:false,
      machineAuthConfigured:false,
      sessionAuthSupported:true,
      status:"session-auth-ready",
      workerReachable:true,
      productionReady:false,
      authMode:"supabase-session",
    });
    expect(mocks.getHealth).not.toHaveBeenCalled();
  });

  it("reports sidecar absence without pretending session auth is production ready",async()=>{
    mocks.isConfigured.mockReturnValue(false);
    mocks.getLiveness.mockResolvedValue({
      reachable:false,
      status:"unavailable",
    });

    const response=await GET();
    await expect(response.json()).resolves.toMatchObject({
      status:"worker-unavailable",
      workerReachable:false,
      productionReady:false,
      sessionAuthSupported:true,
    });
  });

  it("keeps machine-authenticated readiness authoritative when configured",async()=>{
    mocks.isConfigured.mockReturnValue(true);
    mocks.authMode.mockReturnValue("vercel-oidc");
    mocks.getHealth.mockResolvedValue({
      status:"ready",
      productionReady:true,
      authMode:"vercel-oidc",
    });

    const response=await GET();
    await expect(response.json()).resolves.toMatchObject({
      configured:true,
      machineAuthConfigured:true,
      status:"ready",
      productionReady:true,
      authMode:"vercel-oidc",
    });
    expect(mocks.getLiveness).not.toHaveBeenCalled();
  });
});
