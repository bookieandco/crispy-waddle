import { NextRequest,NextResponse } from 'next/server'
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity'
import { toOpportunityView } from '@/lib/opportunities/canonical'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { Opportunity } from '@jhadina/opportunity-core'

export const dynamic='force-dynamic'
export const runtime='nodejs'

type InboxRow={
  id:string
  source_id:string
  state_code:string
  county_name:string|null
  locality:string|null
  stage:string
  title:string
  source_url:string
  payload:{opportunity?:Opportunity}
  captured_at:string
  last_seen_at:string
}

async function identity(){
  const verifier=await createRequestIdentityVerifier()
  return verifier.verify({})
}

function limitFrom(value:string|null):number{
  const parsed=Number(value??50)
  return Number.isInteger(parsed)&&parsed>=1&&parsed<=200?parsed:50
}

export async function GET(request:NextRequest){
  const requestId=crypto.randomUUID()
  try{
    await identity()
    const service=createServiceRoleClient()
    if(!service)return NextResponse.json({ok:false,requestId,error:'public_opportunity_inbox_unavailable'},{status:503})
    let query=service
      .from('jhadina_public_opportunity_inbox')
      .select('id,source_id,state_code,county_name,locality,stage,title,source_url,payload,captured_at,last_seen_at')
      .eq('active',true)
      .order('last_seen_at',{ascending:false})
      .limit(limitFrom(request.nextUrl.searchParams.get('limit')))
    const state=request.nextUrl.searchParams.get('state')?.trim().toUpperCase()
    const county=request.nextUrl.searchParams.get('county')?.trim()
    if(state)query=query.eq('state_code',state)
    if(county)query=query.eq('county_name',county)
    const {data,error}=await query.returns<InboxRow[]>()
    if(error)throw new Error(`public_opportunity_inbox_read_failed:${error.message}`)
    return NextResponse.json({
      ok:true,
      requestId,
      count:data?.length??0,
      discoveries:(data??[]).map(row=>({
        id:row.id,
        sourceId:row.source_id,
        state:row.state_code,
        county:row.county_name,
        locality:row.locality,
        stage:row.stage,
        title:row.title,
        sourceUrl:row.source_url,
        capturedAt:row.captured_at,
        lastSeenAt:row.last_seen_at,
        opportunity:row.payload.opportunity,
      })),
      externalActionAuthorized:false,
    },{headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'public_opportunity_inbox_failed'
    const auth=/Authenticated|identity|session/i.test(message)
    return NextResponse.json(
      {ok:false,requestId,error:auth?'Authentication required':message},
      {status:auth?401:502,headers:{'cache-control':'no-store'}},
    )
  }
}

export async function POST(request:NextRequest){
  const requestId=crypto.randomUUID()
  try{
    const verified=await identity()
    const body=await request.json().catch(()=>({})) as {id?:unknown}
    const id=typeof body.id==='string'?body.id.trim():''
    if(!id)return NextResponse.json({ok:false,requestId,error:'id is required'},{status:400})

    const service=createServiceRoleClient()
    if(!service)return NextResponse.json({ok:false,requestId,error:'public_opportunity_inbox_unavailable'},{status:503})
    const {data,error}=await service
      .from('jhadina_public_opportunity_inbox')
      .select('id,payload')
      .eq('id',id)
      .eq('active',true)
      .maybeSingle<{id:string;payload:{opportunity?:Opportunity}}>()
    if(error)throw new Error(`public_opportunity_inbox_read_failed:${error.message}`)
    const opportunity=data?.payload?.opportunity
    if(!opportunity||opportunity.status!=='discovered'||!opportunity.sourceUrl||!opportunity.sourceName){
      return NextResponse.json({ok:false,requestId,error:'Discovery is not adoptable'},{status:409})
    }

    const adopted:Opportunity={
      ...opportunity,
      metadata:{
        ...(opportunity.metadata??{}),
        publicInboxId:id,
        adoptedAt:new Date().toISOString(),
      },
      updatedAt:new Date().toISOString(),
    }
    const stored=await createSupabaseOpportunityRepository().upsert(verified.userId,adopted,'review')
    return NextResponse.json({
      ok:true,
      requestId,
      opportunity:toOpportunityView(stored),
      externalActionAuthorized:false,
    },{status:201,headers:{'cache-control':'no-store'}})
  }catch(error){
    const message=error instanceof Error?error.message:'public_opportunity_adoption_failed'
    const auth=/Authenticated|identity|session/i.test(message)
    return NextResponse.json(
      {ok:false,requestId,error:auth?'Authentication required':message},
      {status:auth?401:502,headers:{'cache-control':'no-store'}},
    )
  }
}
