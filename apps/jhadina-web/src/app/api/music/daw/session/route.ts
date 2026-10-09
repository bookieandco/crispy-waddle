import { NextRequest, NextResponse } from "next/server";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getMusicDawOwnerSession, saveMusicDawOwnerSession } from "@/lib/music/music-daw-service";
import type { MusicDawSession } from "@jhadina/music-core";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const respond=(body:unknown,status:number)=>
  NextResponse.json(body,{status,headers:{"cache-control":"private, no-store"}});
async function authenticated(request:NextRequest) {
  const claimed=request.headers.get("x-jhadina-user-id")?.trim()??"";
  if(!claimed)throw new Error("MUSIC_DAW_SIGNED_IN_REQUIRED");
  const id=await (await createRequestIdentityVerifier()).verify({userId:claimed});
  const client=createServiceRoleClient();
  if(!client)throw new Error("MUSIC_DAW_STORAGE_NOT_CONFIGURED");
  return {client,ownerUserId:id.userId};
}
function failure(error:unknown) {
  const message=error instanceof Error?error.message:"MUSIC_DAW_UNAVAILABLE";
  const status=/IDENTITY|SESSION|SIGNED_IN|AUTH/i.test(message)?401
    :/REVISION_CONFLICT/.test(message)?409
    :/CASE_NOT_FOUND/.test(message)?404
    :/NOT_CONFIGURED|STORAGE/.test(message)?503:422;
  return respond({success:false,error:message},status);
}
export async function GET(request:NextRequest) {
  try{
    const {client,ownerUserId}=await authenticated(request);
    const caseId=request.nextUrl.searchParams.get("caseId")?.trim()??"";
    if(!caseId||caseId.length>240)return respond({success:false,error:"caseId required"},400);
    const result=await getMusicDawOwnerSession({client,ownerUserId,caseId});
    return respond({success:true,...result},200);
  }catch(error){return failure(error)}
}
export async function POST(request:NextRequest) {
  try{
    const {client,ownerUserId}=await authenticated(request);
    const value=await request.json() as {
      caseId?:unknown; expectedRevision?:unknown; mutationId?:unknown;
      document?:unknown;
    };
    if(typeof value.caseId!=="string"||!value.caseId.trim()||
       value.caseId.length>240||typeof value.expectedRevision!=="number"||
       typeof value.mutationId!=="string"||value.mutationId.length>240||
       !value.document||typeof value.document!=="object") {
      return respond({success:false,error:"Invalid document or revision"},400);
    }
    const result=await saveMusicDawOwnerSession({
      client,ownerUserId,caseId:value.caseId,
      expectedRevision:value.expectedRevision,mutationId:value.mutationId,
      document:value.document as MusicDawSession,
    });
    return respond({success:true,...result},200);
  }catch(error){return failure(error)}
}
