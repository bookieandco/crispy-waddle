import {NextRequest,NextResponse} from "next/server"
import {createClient} from "@/lib/supabase/server"
import {safeAuthNext} from "@/lib/auth/passkey"

export const runtime="nodejs"
export const dynamic="force-dynamic"

/** PKCE email magic-link callback. The verifier stays in the SSR session cookie;
 * never accept an arbitrary redirect URL from the email or response.
 */
export async function GET(request:NextRequest){
 const next=safeAuthNext(request.nextUrl.searchParams.get("next"))
 const code=request.nextUrl.searchParams.get("code")
 const target=request.nextUrl.clone()
 target.pathname="/login"
 target.search=""
 target.searchParams.set("next",next)
 const fail=()=>{target.searchParams.set("error","callback_failed");return NextResponse.redirect(target,{headers:{"cache-control":"private, no-store"}})}
 if(!code||code.length>4096)return fail()
 try{
  const supabase=await createClient()
  const {error}=await supabase.auth.exchangeCodeForSession(code)
  if(error)return fail()
  const {data,error:verifyError}=await supabase.auth.getUser()
  if(verifyError||!data.user||data.user.is_anonymous)return fail()
  const success=request.nextUrl.clone()
  success.pathname=next
  success.search=""
  return NextResponse.redirect(success,{headers:{"cache-control":"private, no-store"}})
 }catch{return fail()}
}
