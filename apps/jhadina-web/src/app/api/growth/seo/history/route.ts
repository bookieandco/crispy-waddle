import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'
import { verifyRegisteredPersonalSeoSite } from '@/lib/business-growth/personal-seo-runtime'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const headers={'cache-control':'no-store'}
/** Bounded, owner-only trend summaries from existing canonical Venture ledger. */
export async function GET(request:NextRequest){
  let userId:string
  try{userId=(await requireRequestIdentity()).userId}
  catch{return NextResponse.json({ok:false,error:'AUTHENTICATION_REQUIRED'},{status:401,headers})}
  const ventureId=request.nextUrl.searchParams.get('ventureId')??''
  if(!ventureId || ventureId.length>200)
    return NextResponse.json({ok:false,error:'VENTURE_REQUIRED'},{status:400,headers})
  try{
    await verifyRegisteredPersonalSeoSite({ownerUserId:userId,ventureId})
    const db=createServiceRoleClient()
    if(!db)throw new Error('STORAGE_UNAVAILABLE')
    const entries=(await new VentureRuntimeRepository(db).listWorkItems(userId,ventureId))
      .filter(x=>x.id.startsWith('personal-seo:weekly:'+ventureId+':'))
      .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,12)
      .map(row=>{
        const value=(prefix:string)=>{
          const found=row.outputRefs.find(ref=>ref.startsWith(prefix))
          return found?Number(found.slice(prefix.length)):null
        }
        return {
          date:row.createdAt.slice(0,10),technicalFindings:value('personal-seo:technical-count:'),
          linkReviewItems:value('personal-seo:link-count:'),
          observedCountChange:value('personal-seo:observed-count-change:'),
          evidenceRefs:row.evidenceRefs,
          completeness:'OBSERVED_PAGES_ONLY',claimsRankImprovement:false,
        }
      })
    return NextResponse.json({ok:true,entries,
      autoFixesPerformed:0,searchRankingImprovementVerified:false},{headers})
  }catch{
    return NextResponse.json({ok:false,error:'PERSONAL_SEO_HISTORY_UNAVAILABLE'},{status:503,headers})
  }
}
