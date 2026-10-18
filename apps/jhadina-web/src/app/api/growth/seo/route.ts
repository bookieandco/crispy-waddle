import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { personalSeoSnapshot, registeredPersonalSeoSites } from '@/lib/business-growth/personal-seo-runtime'
import { GSC_COOKIE,readPersonalGscGrant } from '@/lib/business-growth/personal-seo-google-oauth'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
const headers={'cache-control':'no-store'}
/** Owner's registry only; does not disclose other accounts or issue credentials. */
export async function GET(request:NextRequest){
  let userId:string
  try{userId=(await requireRequestIdentity()).userId}
  catch{return NextResponse.json({ok:false,error:'AUTHENTICATION_REQUIRED'},{status:401,headers})}
  try{
    return NextResponse.json({ok:true,
      sites:registeredPersonalSeoSites().filter(s=>s.ownerUserId===userId)
        .map(s=>({ventureId:s.ventureId,website:s.website,gscConfigured:!!s.gscProperty,
          gscSessionAuthorized:!!readPersonalGscGrant({cookie:request.cookies.get(GSC_COOKIE)?.value,
            ownerUserId:userId,ventureId:s.ventureId})})),
      externalActionAuthorized:false},{headers})
  }catch{
    return NextResponse.json({ok:false,error:'PERSONAL_SEO_REGISTRY_UNAVAILABLE'},{status:503,headers})
  }
}
export async function POST(request:NextRequest){
  let userId:string
  try{userId=(await requireRequestIdentity()).userId}
  catch{return NextResponse.json({ok:false,error:'AUTHENTICATION_REQUIRED'},{status:401,headers})}
  // Explicit same-origin owner action prevents browser cross-site scan triggering.
  const origin=request.headers.get('origin')
  if(!origin || origin!==request.nextUrl.origin)
    return NextResponse.json({ok:false,error:'PERSONAL_SEO_ORIGIN_DENIED'},{status:403,headers})
  if(Number(request.headers.get('content-length')??0)>2048)
    return NextResponse.json({ok:false,error:'PERSONAL_SEO_REQUEST_TOO_LARGE'},{status:413,headers})
  let body:Record<string,unknown>
  try{body=await request.json() as Record<string,unknown>}
  catch{return NextResponse.json({ok:false,error:'PERSONAL_SEO_INPUT_INVALID'},{status:400,headers})}
  const ventureId=body?.ventureId
  const mode=body?.mode
  const strategy=body?.strategy
  if(typeof ventureId!=='string'||!ventureId.trim()||ventureId.length>200||
    !['crawl','gsc','pagespeed'].includes(String(mode))||
    (strategy!==undefined&&!['mobile','desktop'].includes(String(strategy)))){
    return NextResponse.json({ok:false,error:'PERSONAL_SEO_INPUT_INVALID'},{status:400,headers})
  }
  try{
    const data=await personalSeoSnapshot({
      ownerUserId:userId,ventureId,mode:mode as 'crawl'|'pagespeed'|'gsc',
      strategy:strategy as 'mobile'|'desktop'|undefined,
      browserGscRefreshToken:mode==='gsc'?readPersonalGscGrant({
        cookie:request.cookies.get(GSC_COOKIE)?.value,ownerUserId:userId,ventureId,
      })?.refreshToken:undefined,
    })
    return NextResponse.json({ok:true,report:data,
      publishingAuthorized:false,spendingAuthorized:false},{headers})
  }catch(error){
    const message=error instanceof Error?error.message:''
    const setup=/NOT_REGISTERED|NOT_COMMISSIONED|REGISTRY|STORAGE/.test(message)
    return NextResponse.json({ok:false,error:setup?'PERSONAL_SEO_SETUP_REQUIRED':
      'PERSONAL_SEO_SCAN_UNAVAILABLE',externalActionAuthorized:false},
      {status:setup?503:422,headers})
  }
}
