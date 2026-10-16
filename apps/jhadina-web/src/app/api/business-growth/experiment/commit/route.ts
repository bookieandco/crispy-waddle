import { NextResponse } from 'next/server'
import { createBusinessGrowthExperiment } from '@jhadina/growth-core'
import type { VentureWorkItem } from '@jhadina/opportunity-core'
import { requireRequestIdentity } from '@/lib/auth/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'
export const runtime='nodejs'
export const dynamic='force-dynamic'

/**
 * Explicit owner-selected plan admission to the EXISTING Venture ledger.
 * The checkpoints are no-spend tasks, not an autonomous worker schedule.
 * Neither 'queued' nor 'blocked' authorizes an external effect.
 */
export async function POST(request: Request) {
  let ownerUserId: string
  try { ownerUserId=(await requireRequestIdentity()).userId }
  catch { return NextResponse.json({ok:false,error:'AUTHENTICATION_REQUIRED'}, {status:401}) }
  try {
    if (Number(request.headers.get('content-length')??0)>8192) {
      return NextResponse.json({ok:false,error:'EXPERIMENT_PLAN_TOO_LARGE'},{status:413})
    }
    const input=await request.json() as {ventureId?:string;startDate?:string;hypothesis?:string}
    if (!input || typeof input.ventureId!=='string' || typeof input.startDate!=='string'
      || typeof input.hypothesis!=='string' || input.hypothesis.length>500 || !input.ventureId.trim()) {
      return NextResponse.json({ok:false,error:'EXPERIMENT_PLAN_INVALID'},{status:400})
    }
    const client=createServiceRoleClient()
    if(!client) return NextResponse.json({ok:false,error:'VENTURE_RUNTIME_UNAVAILABLE'},{status:503})
    const repository=new VentureRuntimeRepository(client)
    const venture=await repository.getVenture(ownerUserId,input.ventureId.trim())
    if(!venture) return NextResponse.json({ok:false,error:'OWNED_VENTURE_NOT_FOUND'},{status:404})
    if(['killed','archived','paused'].includes(venture.lifecycle)) {
      return NextResponse.json({ok:false,error:'VENTURE_NOT_ACTIVE'},{status:409})
    }
    const experiment=createBusinessGrowthExperiment({
      id:'growth-experiment:'+venture.id+':'+input.startDate,
      ventureId:venture.id,businessId:venture.id,
      startDate:input.startDate,hypothesis:input.hypothesis,
    })
    const now=new Date().toISOString()
    const tasks: VentureWorkItem[]=experiment.checkpoints.map(checkpoint=>({
      id:experiment.id+':day:'+checkpoint.day,
      ventureId:venture.id,
      agentId:'marisa:operations',
      step:'growth_experiment:'+checkpoint.phase.toLowerCase()+':day:'+checkpoint.day,
      status:checkpoint.day===1?'queued':'blocked',
      createdAt:now,updatedAt:now,
      evidenceRefs:['growth:planning:'+experiment.id], // planning ref, never provider evidence
      outputRefs:[],spendUsd:0,authorizationEffect:'NONE',
    }))
    const previous=await repository.listWorkItems(ownerUserId,venture.id)
    const existingIds=new Set(previous.map(task=>task.id))
    const newTasks=tasks.filter(task=>!existingIds.has(task.id))
    if(newTasks.length) await repository.upsertWorkItems(ownerUserId,newTasks,{insertOnly:true})
    return NextResponse.json({
      ok:true,experimentId:experiment.id,ventureId:venture.id,
      insertedPlanningTasks:newTasks.length,alreadyPresent:tasks.length-newTasks.length,
      externalExecutionAuthorized:false,ownerApprovedSpendUsd:0,
      backgroundSchedulingEnabled:false,providerEvidence:'NONE',
    },{headers:{'cache-control':'no-store'}})
  } catch (error) {
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'EXPERIMENT_COMMIT_FAILED'},
      {status:400,headers:{'cache-control':'no-store'}})
  }
}
