import {NextRequest,NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"
import {createServiceRoleClient} from "@/lib/supabase/service-role"
import {getArtifactRuntimeState,retryArtifactExtraction} from "@/lib/artifacts/artifact-extraction-runtime"

export const runtime="nodejs"

async function identityFor(req:NextRequest){
 const claimed=req.headers.get("x-jhadina-user-id")||""
 if(!claimed)throw new Error("ARTIFACT_IDENTITY_REQUIRED")
 return (await createRequestIdentityVerifier()).verify({userId:claimed})
}

export async function GET(req:NextRequest,context:{params:Promise<{id:string}>}){
 try{
  const identity=await identityFor(req)
  const {id}=await context.params
  const client=createServiceRoleClient()
  if(!client)throw new Error("ARTIFACT_STORAGE_NOT_CONFIGURED")
  const artifact=await getArtifactRuntimeState(client,identity.userId,id)
  return NextResponse.json({success:true,artifact})
 }catch(error){
  return artifactError(error)
 }
}

export async function POST(req:NextRequest,context:{params:Promise<{id:string}>}){
 try{
  const identity=await identityFor(req)
  const {id}=await context.params
  const client=createServiceRoleClient()
  if(!client)throw new Error("ARTIFACT_STORAGE_NOT_CONFIGURED")
  const artifact=await retryArtifactExtraction({
   client,
   ownerUserId:identity.userId,
   artifactId:id,
   extractorUrl:process.env.JHADINA_ARTIFACT_EXTRACTOR_URL??"",
   extractorToken:process.env.JHADINA_ARTIFACT_EXTRACTOR_TOKEN??"",
  })
  return NextResponse.json({success:true,artifact})
 }catch(error){
  return artifactError(error)
 }
}

function artifactError(error:unknown){
 const message=error instanceof Error?error.message:"Artifact request failed"
 const status=/IDENTITY|identity|session/.test(message)?401:
  /NOT_FOUND/.test(message)?404:
  /REQUIRES_CLEAN/.test(message)?409:
  /MIME_UNSUPPORTED/.test(message)?422:
  /SIZE/.test(message)?413:503
 return NextResponse.json({success:false,error:message},{status})
}
