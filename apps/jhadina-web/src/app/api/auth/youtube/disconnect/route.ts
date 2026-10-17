import {NextRequest,NextResponse} from "next/server"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"

export const runtime="nodejs"
export const dynamic="force-dynamic"

// Local browser disconnect. This does not revoke Google's grant; users can
// revoke app access independently in Google Account security settings.
export async function POST(request:NextRequest) {
  try { await (await createRequestIdentityVerifier()).verify({}) }
  catch { return NextResponse.json({success:false,error:"Sign in before managing YouTube."},{status:401,headers:{"Cache-Control":"private, no-store"}}) }
  const origin=request.headers.get("origin")
  if(origin && origin!==request.nextUrl.origin)return NextResponse.json({success:false,error:"Invalid request origin"},{status:403,headers:{"Cache-Control":"private, no-store"}})
  const response=NextResponse.json({success:true,connection:"disconnected",note:"Removed YouTube credentials from this browser only."},{headers:{"Cache-Control":"private, no-store"}})
  for(const name of ["jhadina_youtube_owner","jhadina_youtube_access","jhadina_youtube_oauth_state","jhadina_youtube_oauth_owner"]){
    response.cookies.set(name,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0})
  }
  response.cookies.set("jhadina_youtube_refresh","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/api",maxAge:0})
  return response
}
