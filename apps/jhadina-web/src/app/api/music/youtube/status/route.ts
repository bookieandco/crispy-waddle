import {NextRequest,NextResponse} from "next/server"
import {decryptSecret} from "@/lib/youtube-oauth"
import {createRequestIdentityVerifier} from "@/lib/auth/request-identity"

export const runtime="nodejs"
export const dynamic="force-dynamic"
const reply=(body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}})

export async function GET(req:NextRequest) {
  let identity:string
  try { identity=(await (await createRequestIdentityVerifier()).verify({})).userId }
  catch { return reply({connected:false,reason:"unauthenticated"},401) }

  const configured=Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
    process.env.JHADINA_OAUTH_ENCRYPTION_KEY && (process.env.YOUTUBE_REDIRECT_URI || process.env.NEXT_PUBLIC_APP_URL))
  if(!configured)return reply({connected:false,configured:false,reason:"not_configured"})

  const access=req.cookies.get("jhadina_youtube_access")?.value
  const refresh=req.cookies.get("jhadina_youtube_refresh")?.value
  const owner=req.cookies.get("jhadina_youtube_owner")?.value
  try {
    if(!owner || decryptSecret(owner)!==identity)return reply({connected:false,configured:true,reason:"reauthorize"})
    if(!access&&!refresh)return reply({connected:false,configured:true,reason:"reauthorize"})
    decryptSecret(access??refresh!)
    return reply({connected:true,configured:true,provider:"youtube",
      note:"Browser-local authorization present; actual provider health is checked by the Home feed"})
  }catch{return reply({connected:false,configured:true,reason:"reauthorize"})}
}
