import { beforeEach,describe,expect,it,vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/request-identity",()=>({
  createRequestIdentityVerifier:vi.fn(),
}));
vi.mock("@/lib/supabase/service-role",()=>({
  createRuntimeServiceRoleClient:vi.fn(),
}));
vi.mock("@/lib/music/restoration-runtime-server",()=>({
  createMusicRestorationRuntimeClient:vi.fn(),
}));
vi.mock("@/lib/music/restoration-supabase-store",()=>({
  SupabaseMusicRestorationArtifactStore:vi.fn(function (){return {}})
}));
vi.mock("@jhadina/music-core",()=>({
  MAX_MUSIC_PROTOTYPE_WAV_BYTES:3145728,
  ingestRestorationPrototypeWav:vi.fn(),
  ingestRestorationSource:vi.fn(),
}));
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { createRuntimeServiceRoleClient } from "@/lib/supabase/service-role";
import { createMusicRestorationRuntimeClient } from "@/lib/music/restoration-runtime-server";
import { ingestRestorationPrototypeWav,ingestRestorationSource } from "@jhadina/music-core";
import { POST } from "./route";

function request(input:{name?:string;size?:number;mode?:string;user?:string}={}){
  const form=new FormData();
  const f=new File([new Uint8Array(input.size??64)],input.name??"demo.wav",{type:"audio/wav"});
  form.append("file",f);
  return new NextRequest("https://jhadina.test/api/music/restoration/ingest"+
    (input.mode?"?mode="+input.mode:""),{
      method:"POST",headers:input.user===undefined?{"x-jhadina-user-id":"owner-1"}:
        input.user?{"x-jhadina-user-id":input.user}:{},
      body:form,
    });
}
const result={
  restorationCase:{id:"case-001",title:"demo",status:"draft",
    sourceVersionId:"v1",currentVersionId:"v1"},
  artifact:{id:"art-001",contentHash:"b".repeat(64),
    sampleRate:48000,channels:1,sampleCount:64,sizeBytes:128},
  fingerprint:{sampleRateHz:48000},mode:"prototype-wav",
  workerUsed:false,restorationCertified:false,
};

describe("music restoration worker-free WAV draft route",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    vi.mocked(createRequestIdentityVerifier).mockResolvedValue({
      verify:vi.fn(async({userId}:{userId:string})=>({userId})),
    } as never);
    vi.mocked(createRuntimeServiceRoleClient).mockResolvedValue({} as never);
    vi.mocked(ingestRestorationPrototypeWav).mockResolvedValue(result as never);
  });
  it("admits a verified owner to the explicit prototype path without any AI worker",async()=>{
    const response=await POST(request({mode:"prototype-wav"}));
    const body=await response.json();
    expect(response.status).toBe(200);
    expect(body.mode).toBe("prototype-wav");
    expect(body.workerUsed).toBe(false);
    expect(body.restorationCertified).toBe(false);
    expect(body.runtimeReceiptId).toBeNull();
    expect(createMusicRestorationRuntimeClient).not.toHaveBeenCalled();
    expect(ingestRestorationSource).not.toHaveBeenCalled();
    expect(ingestRestorationPrototypeWav).toHaveBeenCalledWith(
      expect.objectContaining({ownerUserId:"owner-1",mimeType:"audio/wav"}));
  });
  it("rejects oversized prototype file before privileged storage",async()=>{
    const response=await POST(request({mode:"prototype-wav",size:3145729}));
    expect(response.status).toBe(413);
    expect(createRuntimeServiceRoleClient).not.toHaveBeenCalled();
  });
  it("rejects unsigned and forged identities without touching privileged storage",async()=>{
    expect((await POST(request({mode:"prototype-wav",user:""}))).status).toBe(401);
    vi.mocked(createRequestIdentityVerifier).mockResolvedValueOnce({
      verify:vi.fn(async()=>{throw new Error("IDENTITY_MISMATCH")}),
    } as never);
    expect((await POST(request({mode:"prototype-wav"}))).status).toBe(401);
    expect(createRuntimeServiceRoleClient).not.toHaveBeenCalled();
  });
  it("fails closed if the request has no server privileged transport",async()=>{
    vi.mocked(createRuntimeServiceRoleClient).mockResolvedValueOnce(null);
    const response=await POST(request({mode:"prototype-wav"}));
    expect(response.status).toBe(503);
    expect(ingestRestorationPrototypeWav).not.toHaveBeenCalled();
  });
});
