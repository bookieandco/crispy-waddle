import { NextRequest, NextResponse } from 'next/server'
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity'
import { canonicalizeSamNotice } from '@/lib/money-opportunities/canonical-sam-workflow'
import { readPublicSamIntelligence, readRawSamCatalogNotice } from '@/lib/money-opportunities/sam-catalog-view'
import { toOpportunityView } from '@/lib/opportunities/canonical'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const dynamic='force-dynamic'

function id(value:string){
  const v=decodeURIComponent(value).trim()
  if(!v||v.length>160||!/^[A-Za-z0-9._:\/-]+$/.test(v))throw new Error('Invalid notice id')
  return v
}
export async function GET(_request:NextRequest,{params}:{params:{noticeId:string}}){
  try{
    await (await createRequestIdentityVerifier()).verify({})
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'SAM catalog is not configured'},{status:503})
    const intelligence=await readPublicSamIntelligence(client,id(params.noticeId))
    if(!intelligence)return NextResponse.json({ok:false,error:'SAM opportunity not found'},{status:404})
    return NextResponse.json({ok:true,intelligence},{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})
  }catch(error){
    const message=error instanceof Error?error.message:'SAM intelligence failed'
    const auth=/Authenticated|identity|session/i.test(message)
    return NextResponse.json({ok:false,error:auth?'Authentication required':message==='Invalid notice id'?message:'SAM intelligence failed'},{status:auth?401:message==='Invalid notice id'?400:502,headers:{'cache-control':'no-store'}})
  }
}

export async function POST(_request:NextRequest,{params}:{params:{noticeId:string}}){
  try{
    const identity=await (await createRequestIdentityVerifier()).verify({})
    const client=createServiceRoleClient()
    if(!client)return NextResponse.json({ok:false,error:'SAM catalog is not configured'},{status:503})
    const noticeId=id(params.noticeId)
    const raw=await readRawSamCatalogNotice(client,noticeId)
    if(!raw)return NextResponse.json({ok:false,error:'SAM opportunity not found'},{status:404})
    const opportunity=canonicalizeSamNotice(raw)
    const stored=await createSupabaseOpportunityRepository().upsert(identity.userId,opportunity,'review')
    return NextResponse.json({ok:true,opportunity:toOpportunityView(stored)},{status:201,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})
  }catch(error){
    const message=error instanceof Error?error.message:'SAM import failed'
    const auth=/Authenticated|identity|session/i.test(message)
    return NextResponse.json({ok:false,error:auth?'Authentication required':message==='Invalid notice id'?message:'SAM import failed'},{status:auth?401:message==='Invalid notice id'?400:502,headers:{'cache-control':'no-store'}})
  }
}
