import { NextRequest, NextResponse } from 'next/server'
import { preparePersonalSeoRepair } from '@jhadina/growth-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { verifyRegisteredPersonalSeoSite } from '@/lib/business-growth/personal-seo-runtime'
import { crawlRegisteredOwnedSite } from '@/lib/business-growth/personal-seo-crawler'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
const headers={'cache-control':'no-store'}
/** Reobserve actual site state; never accept "before", page evidence, or approval from browser. */
export async function POST(request:NextRequest){
  let userId:string
  try{userId=(await requireRequestIdentity()).userId}
  catch{return NextResponse.json({ok:false,error:'AUTHENTICATION_REQUIRED'},{status:401,headers})}
  if(!request.headers.get('origin')||request.headers.get('origin')!==request.nextUrl.origin)
    return NextResponse.json({ok:false,error:'ORIGIN_DENIED'},{status:403,headers})
  if(Number(request.headers.get('content-length')??0)>4096)
    return NextResponse.json({ok:false,error:'INPUT_TOO_LARGE'},{status:413,headers})
  try{
    const body=await request.json() as Record<string,unknown>
    if(!body||typeof body.ventureId!=='string'||body.ventureId.length>200||
      typeof body.pageUrl!=='string'||body.pageUrl.length>2048||
      !['title','description'].includes(String(body.field))||
      typeof body.after!=='string'||body.after.length>180)
      return NextResponse.json({ok:false,error:'INVALID_PROPOSAL'},{status:400,headers})
    const site=await verifyRegisteredPersonalSeoSite({ownerUserId:userId,ventureId:body.ventureId})
    const now=new Date().toISOString()
    const crawl=await crawlRegisteredOwnedSite({registeredWebsite:site.website,now,maxPages:15})
    const page=crawl.pages.find(p=>p.url===body.pageUrl)
    if(!page)return NextResponse.json({ok:false,error:'TARGET_NOT_OBSERVED'},{status:409,headers})
    const proposal=preparePersonalSeoRepair({
      registeredWebsite:site.website,observedPage:page,
      field:body.field as 'title'|'description',suggestedText:body.after,now,
    })
    return NextResponse.json({ok:true,proposal,actualSiteChanged:false,
      publishingAuthorized:false,externalActionAuthorized:false},{headers})
  }catch{
    return NextResponse.json({ok:false,error:'PROPOSAL_NOT_AVAILABLE'},{status:422,headers})
  }
}
