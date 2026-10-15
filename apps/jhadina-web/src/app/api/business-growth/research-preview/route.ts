import { NextResponse } from 'next/server'
import { reviewAiVisibilitySamples, reviewSerpBuyerIntent,
  type AiAnswerObservation, type SerpResearchSnapshot } from '@jhadina/growth-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * BUSINESS-GROWTH-INTEL: authenticated research PREVIEW, zero writes.
 * Every browser-provided row is forced to MANUAL_UNVERIFIED, regardless of
 * claimed provider/verification. No service account/API keys consumed here.
 */
export async function POST(request: Request) {
  try { await requireRequestIdentity() }
  catch { return NextResponse.json({ok:false,error:'AUTHENTICATION_REQUIRED'},{status:401}) }
  try {
    const length=Number(request.headers.get('content-length')??0)
    if(length>65_536) return NextResponse.json({ok:false,error:'RESEARCH_PREVIEW_TOO_LARGE'},{status:413})
    const body=await request.json() as Record<string,unknown>
    if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.mode!=='string'||
      typeof body.site!=='string') return NextResponse.json({ok:false,error:'RESEARCH_INPUT_INVALID'},{status:400})
    const now=new Date().toISOString()
    if(body.mode==='AI_VISIBILITY') {
      if(typeof body.brand!=='string'||!Array.isArray(body.observations)||body.observations.length>25) {
        return NextResponse.json({ok:false,error:'RESEARCH_SAMPLES_INVALID'},{status:400})
      }
      const raw=body.observations as AiAnswerObservation[]
      const sanitized=raw.map((row,i)=>({
        ...row,id:'manual:'+i,source:'MANUAL_UNVERIFIED' as const,
        // The response may be pasted from a provider, but the server cannot
        // independently verify either the timestamp or the claimed source.
        sourceRef:'user:manual:'+i, observedAt:now,
      }))
      const summary=reviewAiVisibilitySamples({
        site:body.site,brand:body.brand,
        aliases:Array.isArray(body.aliases)?(body.aliases as string[]).slice(0,10):[],
        now,observations:sanitized,
      })
      return NextResponse.json({ok:true,mode:body.mode,summary,
        evidenceStatus:'UNVERIFIED_BROWSER_INPUT',persistence:'NONE',
        earnedXp:0,externalActionAuthorized:false},
        {headers:{'cache-control':'no-store'}})
    }
    if(body.mode==='SERP_INTENT') {
      if(!body.snapshot||typeof body.snapshot!=='object'||Array.isArray(body.snapshot) ||
        !Array.isArray(body.ownedPages)||!Array.isArray(body.validatedOfferIds))
        return NextResponse.json({ok:false,error:'RESEARCH_SERP_INPUT_INVALID'},{status:400})
      const raw=body.snapshot as SerpResearchSnapshot
      const snapshot={...raw,source:'MANUAL_UNVERIFIED' as const,sourceRef:'user:manual-serp',observedAt:now}
      const summary=reviewSerpBuyerIntent({
        site:body.site,now,snapshot,
        ownedPages:body.ownedPages as string[],validatedOfferIds:[],
        // Browser self-declared offerIds cannot mean canonical validation.
      })
      return NextResponse.json({ok:true,mode:body.mode,summary,
        evidenceStatus:'UNVERIFIED_BROWSER_INPUT',persistence:'NONE',
        earnedXp:0,externalActionAuthorized:false},
        {headers:{'cache-control':'no-store'}})
    }
    return NextResponse.json({ok:false,error:'RESEARCH_MODE_UNSUPPORTED'},{status:400})
  } catch {
    return NextResponse.json({ok:false,error:'RESEARCH_INPUT_REJECTED'},
      {status:400,headers:{'cache-control':'no-store'}})
  }
}
