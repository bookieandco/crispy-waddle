'use client'

import Link from 'next/link'
import {useEffect,useState} from 'react'

type BusinessContext={
  opportunity_id:string
  side_hustle_family:string
  production_format:string
  source_ref:string
  production_run_id?:string|null
  video_job_id?:string|null
  automation_status?:'planned'|'queued'|'running'|'shot_orchestration_ready'|'review'|'completed'|'blocked'|'failed'
  automation_error?:string|null
  commissioned_at?:string|null
  plan?:{
    activeTask?:string
    targetRuntimeSeconds?:number
    aspectRatio?:string
    evidenceRefs?:string[]
    publicationAuthority?:string
    paidMediaAuthority?:string
  }
}

export function WorkstationBusinessContext({projectId}:{projectId:string}){
  const [context,setContext]=useState<BusinessContext|null>(null)
  const [error,setError]=useState<string|null>(null)
  const [busy,setBusy]=useState(false)

  useEffect(()=>{
    let cancelled=false
    void (async()=>{
      try{
        const response=await fetch('/api/workstation/business-context?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
        const data=await response.json() as {ok?:boolean;context?:BusinessContext|null;error?:string}
        if(!response.ok||!data.ok)throw new Error(data.error??'Unable to load Business Factory context')
        if(!cancelled){setContext(data.context??null);setError(null)}
      }catch(cause){
        if(!cancelled)setError(cause instanceof Error?cause.message:'Unable to load Business Factory context')
      }
    })()
    return()=>{cancelled=true}
  },[projectId])

  async function startProduction(){
    if(!context||busy)return
    setBusy(true);setError(null)
    try{
      const response=await fetch('/api/opportunities/'+encodeURIComponent(context.opportunity_id)+'/specialized',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'start_director_production',projectId}),
      })
      const data=await response.json() as {ok?:boolean;result?:{status?:BusinessContext['automation_status'];productionRunId?:string;videoJobId?:string;nextBoundary?:string};error?:string}
      if(!response.ok||!data.ok)throw new Error(data.error??'Unable to start Director production')
      setContext(current=>current?{
        ...current,
        automation_status:data.result?.status??current.automation_status,
        production_run_id:data.result?.productionRunId??current.production_run_id,
        video_job_id:data.result?.videoJobId??current.video_job_id,
        automation_error:null,
        commissioned_at:new Date().toISOString(),
      }:current)
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Unable to start Director production')
    }finally{
      setBusy(false)
    }
  }

  async function advanceProduction(){
    if(!context||busy)return
    setBusy(true);setError(null)
    try{
      const response=await fetch('/api/opportunities/'+encodeURIComponent(context.opportunity_id)+'/specialized',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'advance_director_production',projectId}),
      })
      const data=await response.json() as {ok?:boolean;result?:{status?:string;nextBoundary?:string};error?:string}
      if(!response.ok||!data.ok)throw new Error(data.error??'Unable to advance Director production')
      setContext(current=>current?{...current,automation_status:'running',automation_error:null}:current)
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Unable to advance Director production')
    }finally{
      setBusy(false)
    }
  }

  if(error)return <p className="text-xs text-destructive">{error}</p>
  if(!context)return null

  return <section className="rounded-xl border bg-background p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Business Factory lineage</p>
        <h2 className="font-semibold">{context.production_format.replaceAll('_',' ')} · {context.side_hustle_family.replaceAll('_',' ')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{context.plan?.activeTask??context.source_ref}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="rounded border px-3 py-1.5 text-sm disabled:opacity-40" disabled={busy||context.automation_status==='running'||context.automation_status==='review'||context.automation_status==='completed'||context.automation_status==='shot_orchestration_ready'} onClick={()=>void startProduction()}>
          {busy?'Starting…':context.automation_status&&context.automation_status!=='planned'?'Resume production':'Start automated production'}
        </button>
        {context.automation_status==='shot_orchestration_ready'?<button className="rounded border px-3 py-1.5 text-sm disabled:opacity-40" disabled={busy} onClick={()=>void advanceProduction()}>Build storyboard + shot list</button>:null}
        <Link className="rounded border px-3 py-1.5 text-sm" href={'/opportunity?selected='+encodeURIComponent(context.opportunity_id)}>Open opportunity</Link>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      <span className="rounded border px-2 py-1">Source: {context.source_ref}</span>
      {context.plan?.aspectRatio?<span className="rounded border px-2 py-1">{context.plan.aspectRatio}</span>:null}
      {typeof context.plan?.targetRuntimeSeconds==='number'?<span className="rounded border px-2 py-1">{context.plan.targetRuntimeSeconds}s target</span>:null}
      <span className="rounded border px-2 py-1">Publish: {context.plan?.publicationAuthority??'NONE'}</span>
      <span className="rounded border px-2 py-1">Paid media: {context.plan?.paidMediaAuthority??'NONE'}</span>
      <span className="rounded border px-2 py-1">Production: {context.automation_status??'planned'}</span>
      {context.production_run_id?<span className="rounded border px-2 py-1">Run: {context.production_run_id}</span>:null}
    </div>
    {context.automation_error?<p className="mt-2 text-xs text-destructive">{context.automation_error}</p>:null}
    {context.automation_status==='shot_orchestration_ready'?<p className="mt-2 text-xs text-muted-foreground">Shot-based production graph is commissioned. Accept a screenplay breakdown, then build the draft storyboard and shot list for review.</p>:null}
    {context.automation_status==='running'?<p className="mt-2 text-xs text-muted-foreground">Production is at a governed review/runner boundary. Storyboard, shot-list, generation and final approvals remain separate from publication.</p>:null}
  </section>
}
