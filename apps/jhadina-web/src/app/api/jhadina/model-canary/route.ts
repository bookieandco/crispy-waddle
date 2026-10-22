import {NextRequest,NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"
import {configuredJllmSelection} from "@/lib/intelligence/production-model-provider"
import {createOllamaLocalInferenceTransport,resolveLocalModelConnection} from "@/lib/intelligence/ollama-local-transport"
import {parseDecisionProposal} from "@jhadina/intelligence-core"

export const runtime="nodejs"
export const dynamic="force-dynamic"

/** Explicit owner-initiated LOCAL model probe. It does not execute Jhadina tools,
 * send stored chat, load private Memory, mutate state, or invoke paid models.
 */
export async function POST(request:NextRequest){
 const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}
 const claimed=request.headers.get("x-jhadina-user-id")?.trim()
 if(!claimed)return NextResponse.json({success:false,error:"Sign in required"},{status:401,headers})
 try{await (await createRequestIdentityVerifier()).verify({userId:claimed})}
 catch{return NextResponse.json({success:false,error:"Owner session required"},{status:401,headers})}
 if(configuredJllmSelection()!=="local")return NextResponse.json({success:false,error:"Local inference is not selected"},{status:409,headers})
 const connection=resolveLocalModelConnection()
 if(!connection)return NextResponse.json({success:false,error:"Private local model is not configured"},{status:503,headers})
 try{
  const transport=createOllamaLocalInferenceTransport(connection)
  const reply=await transport.generate({
   model:connection.model,
   system:"Return one valid JSON object with disposition, recommendation, rationale, evidence, uncertainty, alternatives. You may only respond to this probe. Do not execute tools.",
   prompt:"For contextId=local-model-canary, return a JSON DecisionProposal with disposition DEFER, a brief harmless recommendation saying LOCAL_MODEL_CANARY_OK, a rationale, empty evidence, uncertainty and alternatives. No actions.",
   maxOutputTokens:512,
  })
  const parsed=parseDecisionProposal(reply.text,"local-model-canary")
  if(!parsed.recommendation.includes("LOCAL_MODEL_CANARY_OK"))
   throw new Error("LOCAL_MODEL_CANARY_WRONG_OUTPUT")
  return NextResponse.json({success:true,data:{provider:"local",readiness:"ANSWERED_SCHEMA_CANARY",
   model:connection.model,externallyVerified:false,executionAuthority:"NONE",
   note:"This confirms only the local transport and proposal parser, not factual accuracy or tool execution."}},{headers})
 }catch{
  return NextResponse.json({success:false,error:"Local model failed the private inference canary; no tools were executed."},{status:503,headers})
 }
}
