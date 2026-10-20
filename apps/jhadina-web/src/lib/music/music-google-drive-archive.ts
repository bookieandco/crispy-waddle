import {createHash} from "node:crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import {SupabaseMusicRestorationArtifactStore} from "./restoration-supabase-store";

/** Explicit owner-only, server-side archival into the previously created Drive folder.
 * A ChatGPT-connected Drive account is not an API credential for this server.
 * The owner must authorize a separate OAuth offline token for the Jhadina runtime.
 */
export const MUSIC_DRIVE_ARCHIVE_FOLDER_ID="1KHrGGzQvuvwru0E0OwcKMbvoFHr4AyZr";
export const MUSIC_DRIVE_SYNC_MAX_BYTES=6*1024*1024;
const DRIVE_API="https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD="https://www.googleapis.com/upload/drive/v3/files";

type GoogleCredentials={clientId:string;clientSecret:string;refreshToken:string};
type ArchiveReceipt={
  driveFileId:string;caseId:string;artifactId:string;sourceSha256:string;
  driveReadbackSha256:string;sizeBytes:number;verified:true;folderId:string;
};
export function configuredMusicDriveCredentials(
  env:NodeJS.ProcessEnv=process.env,
):GoogleCredentials|null {
  const clientId=env.MUSIC_GOOGLE_DRIVE_CLIENT_ID?.trim()??"";
  const clientSecret=env.MUSIC_GOOGLE_DRIVE_CLIENT_SECRET?.trim()??"";
  const refreshToken=env.MUSIC_GOOGLE_DRIVE_REFRESH_TOKEN?.trim()??"";
  if(!clientId||!clientSecret||!refreshToken)return null;
  return {clientId,clientSecret,refreshToken};
}
function sha(bytes:Uint8Array){return createHash("sha256").update(bytes).digest("hex");}
function driveUploadLocation(candidate:string) {
  const url=new URL(candidate);
  if(url.protocol!=="https:"||url.hostname!=="www.googleapis.com"||
     url.pathname!=="/upload/drive/v3/files"||
     url.searchParams.get("uploadType")!=="resumable")
    throw new Error("MUSIC_DRIVE_UPLOAD_LOCATION_FORBIDDEN");
  return url.href;
}
async function googleAccessToken(
  creds:GoogleCredentials,fetcher:typeof fetch,
):Promise<string> {
  const response=await fetcher("https://oauth2.googleapis.com/token",{
    method:"POST",redirect:"error",headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({
      client_id:creds.clientId,client_secret:creds.clientSecret,
      refresh_token:creds.refreshToken,grant_type:"refresh_token",
    }),
  });
  if(!response.ok)throw new Error("MUSIC_DRIVE_TOKEN_UNAVAILABLE");
  const body=await response.json() as {access_token?:unknown};
  if(typeof body.access_token!=="string"||!body.access_token)
    throw new Error("MUSIC_DRIVE_TOKEN_INVALID");
  return body.access_token;
}
async function verifyDriveReadback(
  driveId:string,token:string,expectedSha256:string,expectedSize:number,
  fetcher:typeof fetch,
) {
  if(!/^[a-zA-Z0-9_-]{8,128}$/.test(driveId))
    throw new Error("MUSIC_DRIVE_ID_INVALID");
  const response=await fetcher(DRIVE_API+"/"+encodeURIComponent(driveId)+"?alt=media",{
    redirect:"error",headers:{authorization:"Bearer "+token},
  });
  if(!response.ok||!response.body)throw new Error("MUSIC_DRIVE_READBACK_FAILED");
  const hash=createHash("sha256");let total=0;
  const reader=response.body.getReader();
  try {
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      if(!value)continue;
      total+=value.byteLength;
      if(total>expectedSize)throw new Error("MUSIC_DRIVE_READBACK_SIZE_MISMATCH");
      hash.update(value);
    }
  }finally{reader.releaseLock();}
  const result=hash.digest("hex");
  if(total!==expectedSize||result!==expectedSha256)
    throw new Error("MUSIC_DRIVE_READBACK_SHA256_MISMATCH");
  return result;
}
export async function archiveMusicArtifactToGoogleDrive(input:{
  client:SupabaseClient;ownerUserId:string;caseId:string;artifactId:string;
  credentials?:GoogleCredentials|null;fetcher?:typeof fetch;
}):Promise<ArchiveReceipt>{
  const credentials=input.credentials??configuredMusicDriveCredentials();
  if(!credentials)throw new Error("MUSIC_DRIVE_OAUTH_NOT_CONFIGURED");
  const fetcher=input.fetcher??fetch;
  const store=new SupabaseMusicRestorationArtifactStore(input.client,input.ownerUserId);
  const project=await store.getCase(input.caseId);
  const artifact=await store.get(input.ownerUserId,input.artifactId);
  if(!project||!artifact||artifact.caseId!==input.caseId||
    artifact.ownerUserId!==input.ownerUserId)
    throw new Error("MUSIC_DRIVE_OWNER_CASE_MISMATCH");
  if(artifact.sizeBytes<1||artifact.sizeBytes>MUSIC_DRIVE_SYNC_MAX_BYTES)
    throw new Error("MUSIC_DRIVE_SYNC_WORKER_REQUIRED");
  const bytes=await store.downloadArtifactBytes(input.artifactId);
  if(bytes.byteLength!==artifact.sizeBytes||sha(bytes)!==artifact.contentHash.toLowerCase())
    throw new Error("MUSIC_DRIVE_SOURCE_SHA256_MISMATCH");
  const token=await googleAccessToken(credentials,fetcher);
  const name="Jhadina-"+artifact.id.replace(/[^a-zA-Z0-9_.-]/g,"-").slice(0,90)+
    (artifact.mimeType==="audio/wav"?".wav":".bin");
  const metadata={
    name,parents:[MUSIC_DRIVE_ARCHIVE_FOLDER_ID],
    mimeType:artifact.mimeType,
    appProperties:{
      jhadina_source_sha256:artifact.contentHash.toLowerCase(),
      jhadina_source_artifact_id:artifact.id,
    },
  };
  const created=await fetcher(DRIVE_UPLOAD+"?uploadType=resumable&fields=id,name,size,parents",{
    method:"POST",redirect:"error",
    headers:{
      authorization:"Bearer "+token,
      "content-type":"application/json",
      "x-upload-content-type":artifact.mimeType,
      "x-upload-content-length":String(bytes.byteLength),
    },
    body:JSON.stringify(metadata),
  });
  if(!created.ok)throw new Error("MUSIC_DRIVE_UPLOAD_SESSION_FAILED");
  const location=created.headers.get("location");
  if(!location)throw new Error("MUSIC_DRIVE_UPLOAD_LOCATION_MISSING");
  const confirmedUrl=driveUploadLocation(location);
  const uploaded=await fetcher(confirmedUrl,{
    method:"PUT",redirect:"error",headers:{
      authorization:"Bearer "+token,
      "content-type":artifact.mimeType,
      "content-range":"bytes 0-"+(bytes.byteLength-1)+"/"+bytes.byteLength,
    },
    body:Buffer.from(bytes),
  });
  if(!uploaded.ok)throw new Error("MUSIC_DRIVE_UPLOAD_FAILED");
  const receipt=await uploaded.json() as {id?:string;parents?:string[]};
  if(!receipt.id||!receipt.parents?.includes(MUSIC_DRIVE_ARCHIVE_FOLDER_ID))
    throw new Error("MUSIC_DRIVE_FOLDER_OR_RECEIPT_INVALID");
  const checked=await verifyDriveReadback(receipt.id,token,
    artifact.contentHash.toLowerCase(),bytes.byteLength,fetcher);
  return {driveFileId:receipt.id,caseId:input.caseId,artifactId:artifact.id,
    sourceSha256:artifact.contentHash.toLowerCase(),driveReadbackSha256:checked,
    sizeBytes:bytes.byteLength,verified:true,folderId:MUSIC_DRIVE_ARCHIVE_FOLDER_ID};
}
