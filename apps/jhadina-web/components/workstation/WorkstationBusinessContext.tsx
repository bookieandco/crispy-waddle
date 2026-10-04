'use client'

import Link from 'next/link'
import {useEffect,useState} from 'react'

type BusinessContext={
  opportunity_id:string
  side_hustle_family:string
  production_format:string
  source_ref:string
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

  if(error)return <p className="text-xs text-destructive">{error}</p>
  if(!context)return null

  return <section className="rounded-xl border bg-background p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Business Factory lineage</p>
        <h2 className="font-semibold">{context.production_format.replaceAll('_',' ')} · {context.side_hustle_family.replaceAll('_',' ')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{context.plan?.activeTask??context.source_ref}</p>
      </div>
      <Link className="rounded border px-3 py-1.5 text-sm" href={'/opportunity?selected='+encodeURIComponent(context.opportunity_id)}>Open opportunity</Link>
    </div>
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      <span className="rounded border px-2 py-1">Source: {context.source_ref}</span>
      {context.plan?.aspectRatio?<span className="rounded border px-2 py-1">{context.plan.aspectRatio}</span>:null}
      {typeof context.plan?.targetRuntimeSeconds==='number'?<span className="rounded border px-2 py-1">{context.plan.targetRuntimeSeconds}s target</span>:null}
      <span className="rounded border px-2 py-1">Publish: {context.plan?.publicationAuthority??'NONE'}</span>
      <span className="rounded border px-2 py-1">Paid media: {context.plan?.paidMediaAuthority??'NONE'}</span>
    </div>
  </section>
}
