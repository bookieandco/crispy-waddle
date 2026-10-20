import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/request-identity",()=>({
  createRequestIdentityVerifier:vi.fn(),
}));
vi.mock("@/lib/supabase/service-role",()=>({
  createRuntimeServiceRoleClient:vi.fn(),
  createServiceRoleClient:vi.fn(()=>{throw new Error("SYNCHRONOUS_CLIENT_MUST_NOT_BE_USED");}),
}));
vi.mock("@/lib/music/music-daw-service",()=>({
  getMusicDawOwnerSession:vi.fn(),
  saveMusicDawOwnerSession:vi.fn(),
}));

import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { createRuntimeServiceRoleClient } from "@/lib/supabase/service-role";
import { getMusicDawOwnerSession, saveMusicDawOwnerSession } from "@/lib/music/music-daw-service";
import { GET, POST } from "./route";

function request(method:"GET"|"POST",body?:unknown) {
  return new NextRequest("https://jhadina.test/api/music/daw/session?caseId=case-001",{
    method,headers:{"x-jhadina-user-id":"owner-001",...(body?{"content-type":"application/json"}:{})},
    body:body?JSON.stringify(body):undefined,
  });
}

describe("music DAW request-aware service identity",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    vi.mocked(createRequestIdentityVerifier).mockResolvedValue({
      verify:vi.fn(async({userId}:{userId:string})=>({userId})),
    } as never);
    vi.mocked(createRuntimeServiceRoleClient).mockResolvedValue({} as never);
    vi.mocked(getMusicDawOwnerSession).mockResolvedValue({
      title:"Private demo",persisted:false,document:{revision:0},assets:[],urls:[],
    } as never);
    vi.mocked(saveMusicDawOwnerSession).mockResolvedValue({
      persisted:true,document:{revision:1},
    } as never);
  });
  it("loads a private case through the awaited runtime OIDC service client",async()=>{
    const response=await GET(request("GET"));
    expect(response.status).toBe(200);
    expect(vi.mocked(createRuntimeServiceRoleClient)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getMusicDawOwnerSession)).toHaveBeenCalledWith(
      expect.objectContaining({ownerUserId:"owner-001",caseId:"case-001"}),
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("uses the same runtime service client for revision-fenced writes",async()=>{
    const response=await POST(request("POST",{
      caseId:"case-001",expectedRevision:0,mutationId:"edit:0001",
      document:{caseId:"case-001",revision:0},
    }));
    expect(response.status).toBe(200);
    expect(vi.mocked(saveMusicDawOwnerSession)).toHaveBeenCalledWith(
      expect.objectContaining({ownerUserId:"owner-001",expectedRevision:0}),
    );
  });
  it("fails closed if privileged runtime credentials are unavailable",async()=>{
    vi.mocked(createRuntimeServiceRoleClient).mockResolvedValueOnce(null);
    const response=await GET(request("GET"));
    expect(response.status).toBe(503);
    expect(vi.mocked(getMusicDawOwnerSession)).not.toHaveBeenCalled();
  });
  it("does not trust a header that does not match the authenticated session",async()=>{
    vi.mocked(createRequestIdentityVerifier).mockResolvedValueOnce({
      verify:vi.fn(async()=>{throw new Error("IDENTITY_MISMATCH");}),
    } as never);
    const response=await GET(request("GET"));
    expect(response.status).toBe(401);
    expect(vi.mocked(createRuntimeServiceRoleClient)).not.toHaveBeenCalled();
  });
});
