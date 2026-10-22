'use client'
import {useState} from 'react'
/** Generates a canonical, signed-in project plan only. No server/GPU render is dispatched. */
export function WorkstationRenderPlan({projectId}:{projectId:string}){
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const [status,setStatus]=useState<string|null>(null)
 async function prepare(){
  if(busy)return
  setBusy(true);setError(null);setStatus(null)
  try{
   const current=await fetch('/api/workstation/timeline?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
   const read=await current.json() as {ok?:boolean;revision?:number;error?:string}
   if(!current.ok||!read.ok||!Number.isSafeInteger(read.revision))throw new Error(read.error??'Canonical timeline unavailable')
   const response=await fetch('/api/workstation/timeline/render-plan',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({projectId,expectedRevision:read.revision}),
   })
   const data=await response.json() as {ok?:boolean;plan?:unknown;error?:string}
   if(!response.ok||!data.ok||!data.plan)throw new Error(data.error??'Render plan blocked')
   const blob=new Blob([JSON.stringify(data.plan,null,2)],{type:'application/json'})
   const url=URL.createObjectURL(blob)
   const a=document.createElement('a')
   a.href=url
   a.download='director-approved-local-render-plan.json'
   a.click()
   window.setTimeout(()=>URL.revokeObjectURL(url),6000)
   setStatus('Canonical plan saved. Copy the approved original source files into a trusted local media root, then run the governed offline FFmpeg worker. No render has been executed here.')
  }catch(cause){setError(cause instanceof Error?cause.message:'Render plan unavailable')}
  finally{setBusy(false)}
 }
 return <section className="space-y-3 rounded-xl border bg-background p-4">
   <h2 className="font-semibold">Final MP4 — local render handoff</h2>
   <p className="text-sm text-muted-foreground">Prepare a project-bound, approval-checked render manifest. This differs from FCPXML or OTIO interchange. Real FFmpeg output requires a local trusted worker, owned footage and independent final QC.</p>
   <button type="button" className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" onClick={()=>void prepare()} disabled={busy}>{busy?'Checking approved sources…':'Prepare offline FFmpeg plan'}</button>
   {error?<p role="alert" className="text-sm text-destructive">{error}</p>:null}
   {status?<p role="status" className="text-sm text-muted-foreground">{status}</p>:null}
   <p className="text-xs text-muted-foreground">Never dispatches paid generation or publication. Advanced effects, overlaps and transitions fail closed until rendered by a compatible worker.</p>
 </section>
}
