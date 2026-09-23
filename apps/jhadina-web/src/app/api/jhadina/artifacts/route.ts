import { NextRequest,NextResponse } from "next/server"
import { UniversalArtifactCore } from "@jhadina/core-spine"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { SupabaseArtifactBlobStore,SupabaseArtifactRepository } from "@/lib/artifacts/supabase-artifact-adapters"
import { HttpMediaSecurityScanner } from "@/lib/artifacts/http-media-security-scanner"
import { detectArtifactMime } from "@/lib/artifacts/detect-artifact-mime"

export const runtime="nodejs"
export async function POST(req:NextRequest){
 const claimed=req.headers.get("x-jhadina-user-id")||""
 if(!claimed)return NextResponse.json({success:false,error:"Not signed in"},{status:401})
 try{
  const identity=await (await createRequestIdentityVerifier()).verify({userId:claimed})
  const form=await req.formData(); const file=form.get("file")
  if(!(file instanceof File))return NextResponse.json({success:false,error:"file is required"},{status:400})
  const client=createServiceRoleClient(); if(!client)throw new Error("ARTIFACT_STORAGE_NOT_CONFIGURED")
  const bytes=new Uint8Array(await file.arrayBuffer())
  const detected=detectArtifactMime(bytes,file.type)
  const scanner=new HttpMediaSecurityScanner(process.env.JHADINA_MEDIA_SCANNER_URL??"",process.env.JHADINA_MEDIA_SCANNER_TOKEN??"")
  const core=new UniversalArtifactCore(new SupabaseArtifactBlobStore(client),new SupabaseArtifactRepository(client,identity.userId),scanner)
  const artifact=await core.ingest({ownerUserId:identity.userId,name:file.name,declaredMimeType:file.type,detectedMimeType:detected,bytes,provenance:{source:"ask-jhadina-upload"}})
  return NextResponse.json({success:true,artifact:{id:artifact.id,name:artifact.originalName,mimeType:artifact.detectedMimeType,sizeBytes:artifact.sizeBytes,status:artifact.status}})
 }catch(error){
  const message=error instanceof Error?error.message:"Artifact ingest failed"
  const status=/identity|session/.test(message)?401:/SIZE/.test(message)?413:/MIME/.test(message)?415:503
  return NextResponse.json({success:false,error:message},{status})
 }
}
