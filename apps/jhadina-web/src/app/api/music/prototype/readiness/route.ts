import {NextRequest,NextResponse} from "next/server";
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity";
import {createMusicPrototypePrivilegedClient} from "@/lib/music/music-private-runtime";
import {configuredMusicDriveCredentials} from "@/lib/music/music-google-drive-archive";
import {MUSIC_RESTORATION_BUCKET} from "@/lib/music/restoration-supabase-store";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const respond=(body:unknown,status:number)=>NextResponse.json(body,{
  status,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"},
});
export async function GET(request:NextRequest) {
  const userId=request.headers.get("x-jhadina-user-id")?.trim()??"";
  if(!userId)return respond({success:false,error:"MUSIC_PROTOTYPE_SIGN_IN_REQUIRED"},401);
  try {
    const verified=await (await createRequestIdentityVerifier()).verify({userId});
    const client=await createMusicPrototypePrivilegedClient();
    if(!client)return respond({success:false,error:"MUSIC_PROTOTYPE_PRIVATE_CLIENT_UNAVAILABLE"},503);
    const [sessionRead,caseRead,bucketRead]=await Promise.all([
      client.from("music_daw_sessions").select("case_id",{head:true,count:"exact"})
        .eq("owner_user_id",verified.userId),
      client.from("music_restoration_cases").select("id",{head:true,count:"exact"})
        .eq("user_id",verified.userId),
      client.storage.getBucket(MUSIC_RESTORATION_BUCKET),
    ]);
    const sessionSchemaInstalled=!sessionRead.error;
    const privateBucketReady=!bucketRead.error&&bucketRead.data?.public===false;
    return respond({success:true,checks:{
      authenticatedOwner:true,
      privateRuntimeConnected:true,
      dawSessionSchemaInstalled:sessionSchemaInstalled,
      privateMusicStorageReady:privateBucketReady,
      ownedRecordingExists:!caseRead.error&&(caseRead.count??0)>0,
      driveRuntimeOAuthConfigured:configuredMusicDriveCredentials()!==null,
      isolatedRestoreVerified:false,
      physicalIphonePlaybackVerified:false,
      // Explicitly fail closed; no claim that a CI run proves live behavior.
      productionReleaseCertified:false,
    }},200);
  }catch{
    return respond({success:false,error:"MUSIC_PROTOTYPE_AUTH_OR_PREFLIGHT_FAILED"},401);
  }
}
