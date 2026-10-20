import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";
vi.mock("@/lib/auth/request-identity",()=>({createRequestIdentityVerifier:vi.fn()}));
vi.mock("@/lib/music/music-private-runtime",()=>({createMusicPrototypePrivilegedClient:vi.fn()}));
vi.mock("@/lib/music/direct-wav-upload",()=>({
  validateDirectUploadIntent:vi.fn((arg:unknown)=>arg),
  directWavPath:vi.fn(()=>"owner/case/source/hash/song.wav"),
  finalizeDirectWav:vi.fn(async()=>({
    caseId:"music-restoration:608a309b-15d3-4e86-bd88-a4d85156d28a",
    artifactId:"source-1",sha256:"a".repeat(64),sampleRate:48000,
    channels:2,sampleCount:1200,alreadyRegistered:false,
  })),
}));
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity";
import {createMusicPrototypePrivilegedClient} from "@/lib/music/music-private-runtime";
import {finalizeDirectWav} from "@/lib/music/direct-wav-upload";
import {POST} from "./route";
const uid="f6d0ab0f-a35c-4523-9f10-a19ca63b2da5";
const contents={fileName:"song.wav",sha256:"a".repeat(64),
  sizeBytes:4096,mimeType:"audio/wav"};
function req(action:"ticket"|"finalize",claimed=uid){
  return new NextRequest("https://jhadina.test/api/music/restoration/direct-upload",{
    method:"POST",headers:{"content-type":"application/json",
      ...(claimed?{"x-jhadina-user-id":claimed}:{})},
    body:JSON.stringify({action,...contents,caseId:"music-restoration:608a309b-15d3-4e86-bd88-a4d85156d28a"}),
  });
}
describe("direct upload signed owner authorization",()=>{
 beforeEach(()=>{
   vi.clearAllMocks();
   vi.mocked(createRequestIdentityVerifier).mockResolvedValue({
     verify:vi.fn(async({userId}:{userId:string})=>({userId})),
   } as never);
   vi.mocked(createMusicPrototypePrivilegedClient).mockResolvedValue({
     storage:{from:()=>({createSignedUploadUrl:async()=>({
       data:{token:"signed-path-only"},error:null,
     })})},
   } as never);
 });
 it("mints only a path-specific signed token after owner verification",async()=>{
   const response=await POST(req("ticket"));
   const body=await response.json();
   expect(response.status).toBe(200);
   expect(body.token).toBe("signed-path-only");
   expect(body.path).toContain("/source/");
   expect(JSON.stringify(body)).not.toContain("service_role");
   expect(response.headers.get("cache-control")).toContain("no-store");
 });
 it("rejects an unsigned owner before minting privileged storage URLs",async()=>{
   const response=await POST(req("ticket",""));
   expect(response.status).toBe(401);
   expect(createMusicPrototypePrivilegedClient).not.toHaveBeenCalled();
 });
 it("rejects forged owner header claims",async()=>{
   vi.mocked(createRequestIdentityVerifier).mockResolvedValueOnce({
     verify:vi.fn(async()=>{throw new Error("IDENTITY_MISMATCH")}),
   } as never);
   const response=await POST(req("ticket"));
   expect(response.status).toBe(401);
   expect(createMusicPrototypePrivilegedClient).not.toHaveBeenCalled();
 });
 it("blocks preview without an isolated privileged client",async()=>{
   vi.mocked(createMusicPrototypePrivilegedClient).mockResolvedValueOnce(null);
   expect((await POST(req("ticket"))).status).toBe(503);
 });
 it("finalizes only through authenticated server-side hash verification",async()=>{
   const response=await POST(req("finalize"));
   expect(response.status).toBe(200);
   const data=await response.json();
   expect(data.mode).toBe("direct-private-wav");
   expect(data.restorationCertified).toBe(false);
   expect(finalizeDirectWav).toHaveBeenCalledWith(expect.objectContaining({
     ownerUserId:uid,sha256:"a".repeat(64),
   }));
 });
});
