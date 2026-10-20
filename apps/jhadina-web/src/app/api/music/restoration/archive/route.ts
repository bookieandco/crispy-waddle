import {NextRequest,NextResponse} from "next/server";
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity";
import {createMusicPrototypePrivilegedClient} from "@/lib/music/music-private-runtime";
import {archiveMusicArtifactToGoogleDrive} from "@/lib/music/music-google-drive-archive";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

const respond=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{
  "cache-control":"private, no-store","x-content-type-options":"nosniff",
}});
export async function POST(request:NextRequest) {
  const claimed=request.headers.get("x-jhadina-user-id")?.trim()??"";
  if(!claimed)return respond({success:false,error:"MUSIC_DRIVE_SIGNED_IN_REQUIRED"},401);
  try{
    const {userId}=await (await createRequestIdentityVerifier()).verify({userId:claimed});
    const client=await createMusicPrototypePrivilegedClient();
    if(!client)return respond({success:false,error:"MUSIC_DRIVE_STORAGE_NOT_CONFIGURED"},503);
    const value=await request.json() as Record<string,unknown>;
    const caseId=typeof value.caseId==="string"?value.caseId:"";
    const artifactId=typeof value.artifactId==="string"?value.artifactId:"";
    if(!caseId||caseId.length>200||!artifactId||artifactId.length>250)
      return respond({success:false,error:"MUSIC_DRIVE_BAD_REQUEST"},400);
    // An explicit user action is required. Never silently export private
    // recordings or accept a public/shared Drive destination from the browser.
    if(value.approved!==true)
      return respond({success:false,error:"MUSIC_DRIVE_OWNER_APPROVAL_REQUIRED"},403);
    const receipt=await archiveMusicArtifactToGoogleDrive({
      client,ownerUserId:userId,caseId,artifactId,
    });
    return respond({success:true,...receipt},200);
  }catch(error){
    const message=error instanceof Error?error.message:"MUSIC_DRIVE_UNAVAILABLE";
    const errorCode=message.match(/^MUSIC_DRIVE_[A-Z_0-9]+/)?.[0]??"MUSIC_DRIVE_FAILED";
    const status=/SESSION|IDENTITY|AUTH/i.test(message)?401:
      /OWNER_CASE_MISMATCH/.test(message)?404:
      /OAUTH_NOT_CONFIGURED|STORAGE_NOT_CONFIGURED/.test(message)?503:
      /SYNC_WORKER_REQUIRED/.test(message)?413:422;
    return respond({success:false,error:errorCode},status);
  }
}
