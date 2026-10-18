import { NextResponse } from 'next/server'
import type { VentureWorkItem } from '@jhadina/opportunity-core'
import { authorizedSchedulerRequest } from '@/lib/internal-scheduler-auth'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'
import { registeredPersonalSeoSites, personalSeoSnapshot } from '@/lib/business-growth/personal-seo-runtime'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=300
const headers={'cache-control':'no-store'}
/**
 * JH-PERSONAL-SEO.08: opt-in read-only weekly monitoring.
 * Writes only a blocked INTERNAL review task to existing Venture ledger,
 * no publish/spend/auto-fix. Private scheduler identity is mandatory.
 */
export async function POST(request:Request){
  if(!(await authorizedSchedulerRequest(request)))
    return NextResponse.json({ok:false,error:'UNAUTHORIZED'},{status:401,headers})
  if(process.env.JHADINA_PERSONAL_SEO_WATCH_ENABLED!=='true')
    return NextResponse.json({ok:false,error:'WATCH_NOT_COMMISSIONED'},{status:503,headers})
  try{
    const db=createServiceRoleClient()
    if(!db)throw new Error('STORAGE_UNAVAILABLE')
    const repo=new VentureRuntimeRepository(db)
    const sites=registeredPersonalSeoSites()
    if(!sites.length)throw new Error('NO_OWNED_SITES')
    const recordedAt=new Date().toISOString()
    const day=recordedAt.slice(0,10)
    const results:Array<{ventureId:string;status:'RECORDED'|'INCOMPLETE';findings?:number}>=[]
    for(const site of sites.slice(0,8)){
      try{
        const report=await personalSeoSnapshot({
          ownerUserId:site.ownerUserId,ventureId:site.ventureId,mode:'crawl',now:recordedAt,maxPages:3,
        })
        const detail=report.diagnostics as {scannedPageCount:number;findings:unknown[]}
        const links=report.links as {findings:unknown[]}
        if(!detail||detail.scannedPageCount===0)throw new Error('EMPTY_SCAN')
        const earlier=(await repo.listWorkItems(site.ownerUserId,site.ventureId))
          .filter(item=>item.id.startsWith('personal-seo:weekly:'+site.ventureId+':')
            && item.createdAt<recordedAt)
          .sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
        const previous=earlier[0]
        const pastTechnical=previous?.outputRefs.find(ref=>ref.startsWith('personal-seo:technical-count:'))
        const pastLinks=previous?.outputRefs.find(ref=>ref.startsWith('personal-seo:link-count:'))
        const oldTechnical=pastTechnical?Number(pastTechnical.split(':').at(-1)):null
        const oldLinks=pastLinks?Number(pastLinks.split(':').at(-1)):null
        const changes=(oldTechnical!==null&&oldLinks!==null&&
          Number.isFinite(oldTechnical)&&Number.isFinite(oldLinks))
          ? detail.findings.length+links.findings.length-oldTechnical-oldLinks : null
        const task:VentureWorkItem={
          id:'personal-seo:weekly:'+site.ventureId+':'+day,
          ventureId:site.ventureId,agentId:'marisa:operations',
          step:'personal_seo_read_only_review',status:'blocked',
          createdAt:recordedAt,updatedAt:recordedAt,
          evidenceRefs:['personal-seo:read-only:'+day,
            'personal-seo:pages:'+detail.scannedPageCount],
          outputRefs:['personal-seo:technical-count:'+detail.findings.length,
            'personal-seo:link-count:'+links.findings.length,
            ...(changes===null?[]:['personal-seo:observed-count-change:'+changes])],
          spendUsd:0,authorizationEffect:'NONE',
        }
        // Insert-only; never overwrite review history or completed Venture work.
        await repo.upsertWorkItems(site.ownerUserId,[task],{insertOnly:true})
        results.push({ventureId:site.ventureId,status:'RECORDED',
          findings:detail.findings.length+links.findings.length})
      }catch{
        results.push({ventureId:site.ventureId,status:'INCOMPLETE'})
      }
    }
    for(const omitted of sites.slice(8))results.push({ventureId:omitted.ventureId,status:'INCOMPLETE'})
    const complete=results.every(r=>r.status==='RECORDED')
    return NextResponse.json({ok:complete,status:complete?'OBSERVED':'INCOMPLETE',
      results,publishingAuthorized:false,spendingAuthorized:false,
      backgroundChangesAuthorized:false},{status:complete?200:207,headers})
  }catch{
    return NextResponse.json({ok:false,error:'PERSONAL_SEO_MONITOR_UNAVAILABLE',
      backgroundChangesAuthorized:false},{status:503,headers})
  }
}
