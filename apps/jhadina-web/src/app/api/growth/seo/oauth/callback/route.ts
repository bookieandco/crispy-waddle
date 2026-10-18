import { NextRequest, NextResponse } from 'next/server'
import { fetchReadOnlyGscSnapshot } from '@jhadina/growth-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { verifyRegisteredPersonalSeoSite } from '@/lib/business-growth/personal-seo-runtime'
import { GSC_PENDING_COOKIE,GSC_COOKIE,checkPersonalGscConsent,
  exchangePersonalGscCode,encodePersonalGscGrant } from '@/lib/business-growth/personal-seo-google-oauth'

export const runtime='nodejs'
export const dynamic='force-dynamic'
function result(request:NextRequest,status:'connected'|'denied'|'error'){
  const response=NextResponse.redirect(new URL('/growth/seo?gsc='+status,request.url))
  response.headers.set('cache-control','no-store')
  response.cookies.set(GSC_PENDING_COOKIE,'',{
    path:'/api/growth/seo/oauth',httpOnly:true,secure:true,sameSite:'lax',maxAge:0,
  })
  return response
}
/** OAuth callback: identity+state+owned property+read-only provider proof. */
export async function GET(request:NextRequest){
  const query=request.nextUrl.searchParams
  if(query.has('error'))return result(request,'denied')
  let ownerUserId:string
  try{ownerUserId=(await requireRequestIdentity()).userId}
  catch{return result(request,'error')}
  try{
    const pending=checkPersonalGscConsent({
      ownerUserId,pendingCookie:request.cookies.get(GSC_PENDING_COOKIE)?.value,
      state:query.get('state')??undefined,
    })
    const site=await verifyRegisteredPersonalSeoSite({ownerUserId,ventureId:pending.ventureId})
    if(!site.gscProperty)throw new Error('GSC_PROPERTY_NOT_REGISTERED')
    const token=await exchangePersonalGscCode({
      code:query.get('code')??'',codeVerifier:pending.codeVerifier,
    })
    const now=new Date()
    const end=new Date(now.getTime()-3*86400_000)
    const start=new Date(end.getTime()-3*86400_000)
    // The fixed Google Search Console API checks permission and exact owned
    // property. A successful OAuth exchange alone never proves ownership.
    await fetchReadOnlyGscSnapshot({
      businessWebsite:site.website,property:site.gscProperty,
      retrievedAt:now.toISOString(),
      startDate:start.toISOString().slice(0,10),
      endDate:end.toISOString().slice(0,10),
      serverAccessToken:token.accessToken,rowLimit:1,
    })
    const response=result(request,'connected')
    response.cookies.set(GSC_COOKIE,encodePersonalGscGrant({
      ownerUserId,ventureId:site.ventureId,refreshToken:token.refreshToken,
      createdAt:Date.now(),
    }),{
      httpOnly:true,secure:true,sameSite:'lax',
      path:'/api/growth/seo',maxAge:30*86400,
    })
    return response
  }catch{
    return result(request,'error')
  }
}
