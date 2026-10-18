import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { verifyRegisteredPersonalSeoSite } from '@/lib/business-growth/personal-seo-runtime'
import { createPersonalGscConsent, GSC_PENDING_COOKIE } from '@/lib/business-growth/personal-seo-google-oauth'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const headers={'cache-control':'no-store'}
/** Owner must explicitly press Connect in the first-party Jhadina app. */
export async function POST(request:NextRequest){
  let ownerUserId:string
  try{ownerUserId=(await requireRequestIdentity()).userId}
  catch{return NextResponse.json({ok:false,error:'AUTHENTICATION_REQUIRED'},{status:401,headers})}
  if(request.headers.get('origin')!==request.nextUrl.origin)
    return NextResponse.json({ok:false,error:'ORIGIN_DENIED'},{status:403,headers})
  if(Number(request.headers.get('content-length')??0)>1024)
    return NextResponse.json({ok:false,error:'TOO_LARGE'},{status:413,headers})
  try{
    const body=await request.json() as Record<string,unknown>
    if(!body||typeof body.ventureId!=='string'||body.ventureId.length>200||!body.ventureId.trim())
      return NextResponse.json({ok:false,error:'INVALID_VENTURE'},{status:400,headers})
    const site=await verifyRegisteredPersonalSeoSite({ownerUserId,ventureId:body.ventureId})
    if(!site.gscProperty)throw new Error('GSC_PROPERTY_NOT_REGISTERED')
    const consent=createPersonalGscConsent({ownerUserId,ventureId:site.ventureId})
    const result=NextResponse.json({ok:true,authorizationUrl:consent.authorizationUrl,
      scope:'webmasters.readonly',providerConnected:false},{headers})
    result.cookies.set(GSC_PENDING_COOKIE,consent.pendingCookie,{
      httpOnly:true,secure:true,sameSite:'lax',maxAge:600,
      path:'/api/growth/seo/oauth',
    })
    return result
  }catch{
    return NextResponse.json({ok:false,error:'GSC_OWNER_SETUP_REQUIRED'},
      {status:503,headers})
  }
}
