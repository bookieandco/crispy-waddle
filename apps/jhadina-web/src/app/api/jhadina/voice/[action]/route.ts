import {NextRequest,NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"

export const runtime="nodejs"

export async function GET(req:NextRequest,context:{params:Promise<{action:string}>}){
 const claimed=req.headers.get("x-jhadina-user-id")||""
 if(!claimed)return NextResponse.json({success:false,error:"Not signed in"},{status:401})
 try{
  await (await createRequestIdentityVerifier()).verify({userId:claimed})
  const {action}=await context.params
  if(action!=="health")return NextResponse.json({success:false,error:"Unsupported voice action"},{status:404})
  const base=(process.env.JHADINA_VOICE_URL??"").replace(/\/$/,"")
  const token=process.env.JHADINA_VOICE_TOKEN??""
  if(!base||!token){
   return NextResponse.json({
    success:true,
    native:false,
    status:"browser-fallback",
    canonicalVoiceProfile:"jhadina:canonical",
   })
  }
  const response=await fetch(`${base}/health`,{signal:AbortSignal.timeout(12_000),cache:"no-store"})
  const health=await response.json().catch(()=>({}))
  return NextResponse.json({
   success:true,
   native:response.ok,
   status:response.ok?String(health?.status??"reachable"):"unavailable",
   health,
   canonicalVoiceProfile:"jhadina:canonical",
  },{status:200})
 }catch(error){
  const message=error instanceof Error?error.message:"Voice health failed"
  const status=/identity|session/.test(message)?401:200
  return NextResponse.json({
   success:status===200,
   native:false,
   status:"browser-fallback",
   error:message,
   canonicalVoiceProfile:"jhadina:canonical",
  },{status})
 }
}

export async function POST(req:NextRequest,context:{params:Promise<{action:string}>}){
 const claimed=req.headers.get("x-jhadina-user-id")||""
 if(!claimed)return NextResponse.json({success:false,error:"Not signed in"},{status:401})
 try{
  await (await createRequestIdentityVerifier()).verify({userId:claimed})
  const {action}=await context.params
  if(action!=="listen"&&action!=="speak"&&action!=="speak-stream"){
   return NextResponse.json({success:false,error:"Unsupported voice action"},{status:404})
  }
  const base=(process.env.JHADINA_VOICE_URL??"").replace(/\/$/,"")
  const token=process.env.JHADINA_VOICE_TOKEN??""
  if(!base||!token)throw new Error("JHADINA_VOICE_RUNTIME_NOT_CONFIGURED")
  const body=await req.text()
  if(body.length>40_500_000)throw new Error("JHADINA_VOICE_REQUEST_TOO_LARGE")
  const timeout=action==="listen"?90_000:action==="speak-stream"?180_000:120_000
  const timeoutSignal=AbortSignal.timeout(timeout)
  const signal=typeof AbortSignal.any==="function"
   ? AbortSignal.any([req.signal,timeoutSignal])
   : timeoutSignal
  const response=await fetch(`${base}/v1/${action}`,{
   method:"POST",
   headers:{"content-type":"application/json",authorization:`Bearer ${token}`},
   body,
   signal,
  })
  const contentType=response.headers.get("content-type")??"application/json"

  if(action==="speak-stream"&&response.body){
   return new NextResponse(response.body,{
    status:response.status,
    headers:{
     "content-type":contentType,
     "cache-control":"no-store",
     "x-accel-buffering":"no",
    },
   })
  }

  const text=await response.text()
  return new NextResponse(text,{status:response.status,headers:{"content-type":contentType}})
 }catch(error){
  const message=error instanceof Error?error.message:"Voice runtime failed"
  const status=/identity|session/.test(message)?401:/TOO_LARGE/.test(message)?413:503
  return NextResponse.json({success:false,error:message},{status})
 }
}
