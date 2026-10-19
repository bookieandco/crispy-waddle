import { NextRequest,NextResponse } from "next/server";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { importOwnerLocalPluginRender } from "@/lib/music/music-daw-native-import";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const respond=(x:unknown,status:number)=>NextResponse.json(x,{
  status,headers:{"cache-control":"private,no-store"},
});
export async function POST(request:NextRequest){
  const claimed=request.headers.get("x-jhadina-user-id")?.trim()??"";
  if(!claimed)return respond({success:false,error:"Sign in required"},401);
  try{
    const verified=await (await createRequestIdentityVerifier()).verify({userId:claimed});
    const form=await request.formData();
    const required=(key:string)=>String(form.get(key)??"").trim();
    const wav=form.get("audio");
    if(!(wav instanceof File)||wav.size<48||wav.size>24*1024*1024)
      return respond({success:false,error:"Valid bounded WAV required"},400);
    const caseId=required("caseId"),parentArtifactId=required("parentArtifactId");
    const pluginId=required("pluginId");
    if(!caseId||!parentArtifactId||caseId.length>240||parentArtifactId.length>240||
       required("ownerApproved")!=="YES")
      return respond({success:false,error:"Owner, case, source and approval required"},400);
    const receiptText=required("localReceipt");
    if(receiptText.length>10000)return respond({success:false,error:"Receipt too long"},400);
    const localReceipt=JSON.parse(receiptText) as Record<string,unknown>;
    const client=createServiceRoleClient();
    if(!client)throw new Error("MUSIC_DAW_STORAGE_NOT_CONFIGURED");
    const saved=await importOwnerLocalPluginRender({
      client,ownerUserId:verified.userId,caseId,parentArtifactId,pluginId,
      sourceSha256:required("sourceSha256"),
      renderedSha256:required("renderedSha256"),
      renderedBytes:new Uint8Array(await wav.arrayBuffer()),
      approval:true,localReceipt,
    });
    return respond({success:true,...saved},200);
  }catch(e){
    const error=e instanceof Error?e.message:"MUSIC_DAW_NATIVE_IMPORT_FAILED";
    const code=/identity|session|signed in/i.test(error)?401
      :/STORAGE|NOT_CONFIGURED/.test(error)?503:422;
    return respond({success:false,error},code);
  }
}
