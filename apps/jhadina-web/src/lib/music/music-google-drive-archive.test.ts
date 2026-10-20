import {beforeEach,describe,expect,it,vi} from "vitest";
import {createHash} from "node:crypto";

const bytes=Buffer.from("immutable owner's WAV bytes");
const checksum=createHash("sha256").update(bytes).digest("hex");
const state={
  project:{id:"case-1"},
  artifact:{id:"art-1",ownerUserId:"owner-1",caseId:"case-1",
    mimeType:"audio/wav",sizeBytes:bytes.byteLength,contentHash:checksum},
};
vi.mock("./restoration-supabase-store",()=>({
  SupabaseMusicRestorationArtifactStore:vi.fn(function(){
    return {
      getCase:vi.fn(async()=>state.project),
      get:vi.fn(async()=>state.artifact),
      downloadArtifactBytes:vi.fn(async()=>new Uint8Array(bytes)),
    };
  }),
}));
import {archiveMusicArtifactToGoogleDrive,configuredMusicDriveCredentials,
  MUSIC_DRIVE_ARCHIVE_FOLDER_ID} from "./music-google-drive-archive";
const credentials={clientId:"client-id",clientSecret:"secret",refreshToken:"refresh"};
const driveId="valid_drive_id_1234";
function mockFetch(altered=false) {
  return vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=String(input);
    if(url==="https://oauth2.googleapis.com/token")
      return Response.json({access_token:"fresh-token"});
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer fresh-token");
    if(url.startsWith("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable") &&
       init?.method==="POST"){
      const metadata=JSON.parse(String(init.body));
      expect(metadata.parents).toEqual([MUSIC_DRIVE_ARCHIVE_FOLDER_ID]);
      expect(metadata.appProperties.jhadina_source_sha256).toBe(checksum);
      return new Response(null,{status:200,headers:{location:
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=123"}});
    }
    if(url.includes("upload_id=123")&&init?.method==="PUT"){
      expect(Buffer.from(init.body as Uint8Array)).toEqual(bytes);
      return Response.json({id:driveId,parents:[MUSIC_DRIVE_ARCHIVE_FOLDER_ID]});
    }
    if(url.includes("/drive/v3/files/"+driveId+"?alt=media"))
      return new Response(altered?Buffer.from("other bytes"):bytes,{status:200});
    throw new Error("Unexpected Drive request "+url);
  });
}
describe("owner-only Drive audio source archival",()=>{
  beforeEach(()=>{state.project={id:"case-1"};state.artifact={
    id:"art-1",ownerUserId:"owner-1",caseId:"case-1",
    mimeType:"audio/wav",sizeBytes:bytes.byteLength,contentHash:checksum,
  };});
  it("uploads only to canonical private folder and SHA-verifies Drive readback",async()=>{
    const fetcher=mockFetch();
    const receipt=await archiveMusicArtifactToGoogleDrive({
      client:{} as never,ownerUserId:"owner-1",caseId:"case-1",artifactId:"art-1",
      credentials,fetcher:fetcher as unknown as typeof fetch,
    });
    expect(receipt.verified).toBe(true);
    expect(receipt.sourceSha256).toBe(checksum);
    expect(receipt.driveReadbackSha256).toBe(checksum);
  });
  it("never certifies a Drive backup with mismatched readback content",async()=>{
    await expect(archiveMusicArtifactToGoogleDrive({
      client:{} as never,ownerUserId:"owner-1",caseId:"case-1",artifactId:"art-1",
      credentials,fetcher:mockFetch(true) as unknown as typeof fetch,
    })).rejects.toThrow("MUSIC_DRIVE_READBACK_SHA256_MISMATCH");
  });
  it("rejects cross-case access before obtaining OAuth token or uploading",async()=>{
    state.artifact={...state.artifact,caseId:"someone-else"};
    const fetcher=mockFetch();
    await expect(archiveMusicArtifactToGoogleDrive({
      client:{} as never,ownerUserId:"owner-1",caseId:"case-1",artifactId:"art-1",
      credentials,fetcher:fetcher as unknown as typeof fetch,
    })).rejects.toThrow("MUSIC_DRIVE_OWNER_CASE_MISMATCH");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires separately authorized runtime OAuth credentials",()=>{
    expect(configuredMusicDriveCredentials({} as NodeJS.ProcessEnv)).toBeNull();
  });
});
