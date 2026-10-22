import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { searchCommonsImages, validCommonsSearchQuery } from "@/lib/intelligence/commons-media"

/** Owner initiated public media search. Read-only; no Supabase/Memory writes. */
export async function GET(request:NextRequest){
  const claimed=request.headers.get("x-jhadina-user-id")??""
  if(!claimed)return NextResponse.json({success:false,error:"Sign in required"},{status:401,headers:{"Cache-Control":"no-store"}})
  const query=validCommonsSearchQuery(request.nextUrl.searchParams.get("q"))
  if(!query)return NextResponse.json({success:false,error:"Enter a 3–120 character public image search"},{status:400,headers:{"Cache-Control":"no-store"}})
  try{
    const verifier=await createRequestIdentityVerifier()
    await verifier.verify({userId:claimed})
    const result=await searchCommonsImages(query)
    return NextResponse.json({success:true,data:result},{headers:{"Cache-Control":"no-store, private"}})
  }catch(error){
    const message=error instanceof Error?error.message:""
    const status=/identity|auth|session|verified|claim/i.test(message)?401:503
    return NextResponse.json({success:false,error:status===401?"Session verification required":"Public photo search is unavailable; no results were saved."},{status,headers:{"Cache-Control":"no-store"}})
  }
}
