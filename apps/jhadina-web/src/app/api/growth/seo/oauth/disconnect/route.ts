import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { GSC_COOKIE,GSC_PENDING_COOKIE } from '@/lib/business-growth/personal-seo-google-oauth'

export const runtime='nodejs'
export const dynamic='force-dynamic'
/** Local revocation: removes this device's GSC refresh grant only. */
export async function POST(request:NextRequest){
  try{await requireRequestIdentity()}
  catch{return NextResponse.json({ok:false,error:'AUTHENTICATION_REQUIRED'},{status:401,
    headers:{'cache-control':'no-store'}})}
  if(request.headers.get('origin')!==request.nextUrl.origin)
    return NextResponse.json({ok:false,error:'ORIGIN_DENIED'},{status:403,
      headers:{'cache-control':'no-store'}})
  const response=NextResponse.json({ok:true,localGrantCleared:true,
    googleAccountPermissionRevoked:false,backgroundGscGrantModified:false},
    {headers:{'cache-control':'no-store'}})
  response.cookies.set(GSC_COOKIE,'',{path:'/api/growth/seo',
    maxAge:0,httpOnly:true,secure:true,sameSite:'lax'})
  response.cookies.set(GSC_PENDING_COOKIE,'',{path:'/api/growth/seo/oauth',
    maxAge:0,httpOnly:true,secure:true,sameSite:'lax'})
  return response
}
