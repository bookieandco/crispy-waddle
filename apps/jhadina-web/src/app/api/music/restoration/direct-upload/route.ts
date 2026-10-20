import {NextRequest,NextResponse} from "next/server";
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity";
import {createMusicPrototypePrivilegedClient} from "@/lib/music/music-private-runtime";
import {directWavPath,validateDirectUploadIntent,finalizeDirectWav} from "@/lib/music/direct-wav-upload";
import {MUSIC_RESTORATION_BUCKET} from "@/lib/music/restoration-supabase-store";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const response=(body:unknown,status:number)=>NextResponse.json(body,{status,
  headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
async function owner(req:NextRequest){
  const claimed=req.headers.get("x-jhadina-user-id")?.trim()??"";
  if(!claimed)throw new Error("MUSIC_DIRECT_SIGNED_IN_REQUIRED");
  const identity=await (await createRequestIdentityVerifier()).verify({userId:claimed});
  const client=await createMusicPrototypePrivilegedClient();
  if(!client)throw new Error("MUSIC_DIRECT_STORAGE_NOT_CONFIGURED");
  return {userId:identity.userId,client};
}
function failure(error:unknown){
  const message=error instanceof Error?error.message:"MUSIC_DIRECT_UNAVAILABLE";
  // Prevent providers' error strings from leaking Storage tokens/paths.
  const code=message.match(/^MUSIC_DIRECT_[A-Z0-9_]+/)?.[0]??"MUSIC_DIRECT_FAILED";
  const status=/SIGNED_IN|IDENTITY|SESSION|AUTH/i.test(message)?401
    :/NOT_CONFIGURED|UNAVAILABLE/.test(message)?503
    :/CONFLICT/.test(message)?409
    :/SIZE/.test(message)?413:422;
  return response({success:false,error:code},status);
}
export async function POST(req:NextRequest){
  try {
    const {userId,client}=await owner(req);
    const body=await req.json() as Record<string,unknown>;
    const action=body.action;
    if(action==="ticket"){
      const values=validateDirectUploadIntent({
        fileName:String(body.fileName??""),
        sha256:String(body.sha256??""),
        sizeBytes:Number(body.sizeBytes??0),
        mimeType:String(body.mimeType??""),
      });
      const caseId="music-restoration:"+crypto.randomUUID();
      const path=directWavPath(userId,caseId,values.sha256,values.fileName);
      const {data,error}=await client.storage.from(MUSIC_RESTORATION_BUCKET)
        .createSignedUploadUrl(path,{upsert:false});
      if(error||!data?.token)throw new Error("MUSIC_DIRECT_SIGNING_UNAVAILABLE");
      // Token is a short-lived, path-scoped capability. Never log or persist
      // it and never hand a service-role/secret key to the browser.
      return response({success:true,caseId,path,token:data.token,
        bucket:MUSIC_RESTORATION_BUCKET,maxBytes:96*1024*1024},200);
    }
    if(action==="finalize"){
      const result=await finalizeDirectWav({
        client,ownerUserId:userId,
        caseId:String(body.caseId??""),
        fileName:String(body.fileName??""),
        sha256:String(body.sha256??""),
        sizeBytes:Number(body.sizeBytes??0),
        mimeType:String(body.mimeType??""),
      });
      return response({success:true,mode:"direct-private-wav",workerUsed:false,
        restorationCertified:false,restorationCase:{id:result.caseId},
        sourceArtifact:{id:result.artifactId,sha256:result.sha256,
          sampleRate:result.sampleRate,channels:result.channels,
          sampleCount:result.sampleCount},
        alreadyRegistered:result.alreadyRegistered},200);
    }
    return response({success:false,error:"MUSIC_DIRECT_ACTION_INVALID"},400);
  }catch(error){return failure(error);}
}
