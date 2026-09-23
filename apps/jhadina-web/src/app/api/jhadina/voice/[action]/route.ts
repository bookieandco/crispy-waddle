import {NextRequest,NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"

export const runtime="nodejs"

export async function POST(req:NextRequest,context:{params:Promise<{action:string}>}){
 const claimed=req.headers.get("x-jhadina-user-id")||""
 if(!claimed)return NextResponse.json({success:false,error:"Not signed in"},{status:401})
 try{
  await (await createRequestIdentityVerifier()).verify({userId:claimed})
  const {action}=await context.params
  if(action!=="listen"&&action!=="speak")return NextResponse.json({success:false,error:"Unsupported voice action"},{status:404})
  const base=(process.env.JHADINA_VOICE_URL??"").replace(/\/$/,"")
  const token=process.env.JHADINA_VOICE_TOKEN??""
  if(!base||!token)throw new Error("JHADINA_VOICE_RUNTIME_NOT_CONFIGURED")
  const body=await req.text()
  if(body.length>40_500_000)throw new Error("JHADINA_VOICE_REQUEST_TOO_LARGE")
  const response=await fetch(`${base}/v1/${action}`,{
   method:"POST",
   headers:{"content-type":"application/json",authorization:`Bearer ${token}`},
   body,
   signal:AbortSignal.timeout(action==="listen"?90_000:120_000),
  })
  const text=await response.text()
  const contentType=response.headers.get("content-type")??"application/json"
  return new NextResponse(text,{status:response.status,headers:{"content-type":contentType}})
 }catch(error){
  const message=error instanceof Error?error.message:"Voice runtime failed"
  const status=/identity|session/.test(message)?401:/TOO_LARGE/.test(message)?413:503
  return NextResponse.json({success:false,error:message},{status})
 }
}
