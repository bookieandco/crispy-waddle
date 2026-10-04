'use client'

import {useCallback,useEffect,useMemo,useState} from 'react'

type Purpose='creative'|'sports'|'take-qc'
type Receipt={
  job_id?:string
  purpose?:Purpose
  provider_id?:string
  source_kind?:string
  callback_verified?:boolean
  result_count?:number
  persisted_result_count?:number
  status?:string
  error?:string|null
  completed_at?:string
}
type PurposeState={
  commissioned:boolean
  latestReceipt:Receipt|null
  passedReceipt:Receipt|null
}
type EdgeDetectorState={
  configured?:boolean
  reachable?:boolean
  productionReady?:boolean
  provider?:string
  modelId?:string
  modelLicense?:string
  licenseApproved?:boolean
  error?:string
}
type CommissioningState={
  configured:boolean
  runtime?:{
    configured?:boolean
    reachable?:boolean
    source?:string
    productionReady?:boolean
    error?:string
  }
  homebase?:{
    configured?:boolean
    reachable?:boolean
    productionReady?:boolean
    vlmReady?:boolean
    edgePrefilterReady?:boolean
    perceptionMode?:string
    edgeDetector?:EdgeDetectorState
    error?:string
  }
  perception?:{
    preferredMode?:string
    cloudMotionPrefilterAvailable?:boolean
    homebaseEdgePrefilterAvailable?:boolean
    edgeDetector?:EdgeDetectorState|null
    annotationReview?:{
      provider?:string
      configured?:boolean
      reachable?:boolean
      version?:string
      error?:string
    }
  }
  anyCommissioned:boolean
  allCommissioned:boolean
  purposeStatus:Record<Purpose,PurposeState>
}

const LABEL:Record<Purpose,string>={
  creative:'Creative study',
  sports:'Sports perception',
  'take-qc':'Generated-take QC',
}

export function WorkstationWatchCommissioning(){
  const [state,setState]=useState<CommissioningState|null>(null)
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const response=await fetch('/api/director/watch-jobs/commissioning',{cache:'no-store'})
    const data=await response.json() as ({ok?:boolean;error?:string}&Partial<CommissioningState>)
    if(!response.ok||!data.ok)throw new Error(data.error??'Unable to load Director Watch commissioning')
    setState({
      configured:data.configured===true,
      runtime:data.runtime,
      homebase:data.homebase,
      perception:data.perception,
      anyCommissioned:data.anyCommissioned===true,
      allCommissioned:data.allCommissioned===true,
      purposeStatus:(data.purposeStatus??{
        creative:{commissioned:false,latestReceipt:null,passedReceipt:null},
        sports:{commissioned:false,latestReceipt:null,passedReceipt:null},
        'take-qc':{commissioned:false,latestReceipt:null,passedReceipt:null},
      }) as CommissioningState['purposeStatus'],
    })
  },[])

  useEffect(()=>{
    void load().catch(error=>setStatus(error instanceof Error?error.message:'Unable to load Director Watch commissioning'))
  },[load])

  const missing=useMemo(
    ()=>state?(Object.keys(LABEL) as Purpose[]).filter(purpose=>!state.purposeStatus[purpose]?.commissioned):[],
    [state],
  )

  async function commission(purposes:Purpose[]){
    if(!purposes.length||busy)return
    setBusy(true);setStatus(null)
    try{
      const response=await fetch('/api/director/watch-jobs/commissioning',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({purposes}),
      })
      const data=await response.json() as {
        ok?:boolean
        error?:string
        submitted?:Array<{purpose:Purpose;jobId:string;source:string}>
        unavailable?:Array<{purpose:Purpose;reason:string}>
        nextBoundary?:string
      }
      if(!response.ok||!data.ok)throw new Error(data.error??'Watch commissioning dispatch failed')
      const submitted=data.submitted??[]
      const unavailable=data.unavailable??[]
      setStatus([
        submitted.length?submitted.length+' commissioning job'+(submitted.length===1?'':'s')+' submitted.':'',
        unavailable.length?unavailable.map(item=>LABEL[item.purpose]+': '+item.reason).join(' · '):'',
        submitted.length?'Refresh after authenticated callbacks land.':'',
      ].filter(Boolean).join(' '))
      await load()
    }catch(error){
      setStatus(error instanceof Error?error.message:'Watch commissioning dispatch failed')
    }finally{
      setBusy(false)
    }
  }

  return <section className="rounded-xl border bg-background p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">AUTO.9 · Watch commissioning</p>
        <h2 className="font-semibold">Live Watch worker proof</h2>
        <p className="text-xs text-muted-foreground">A green receipt means the configured Watch runtime accepted a real job, returned through the authenticated callback, and persisted evidence. It grants no creative, sports-reality, wager, publication, or spend authority.</p>
      </div>
      <button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={()=>void load()}>Refresh</button>
    </div>

    {state?<div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded border px-2 py-1">Configured: {state.configured?'yes':'no'}</span>
        <span className="rounded border px-2 py-1">Reachable: {state.runtime?.reachable?'yes':'no'}</span>
        <span className="rounded border px-2 py-1">Production-ready: {state.runtime?.productionReady?'yes':'no'}</span>
        <span className="rounded border px-2 py-1">Source: {state.runtime?.source??'—'}</span>
        <span className="rounded border px-2 py-1">Homebase: {state.homebase?.productionReady?'ready':state.homebase?.configured?'configured':'not connected'}</span>
        <span className="rounded border px-2 py-1">Perception: {state.perception?.preferredMode??'unavailable'}</span>
        <span className="rounded border px-2 py-1">CVAT: {state.perception?.annotationReview?.reachable?'online':state.perception?.annotationReview?.configured?'configured':'not configured'}</span>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded border p-3 text-xs">
          <p className="font-medium">Homebase edge perception</p>
          <p className="mt-1 text-muted-foreground">
            {state.homebase?.edgeDetector?.productionReady
              ?[(state.homebase.edgeDetector.provider??'detector'),state.homebase.edgeDetector.modelId].filter(Boolean).join(' · ')
              :state.homebase?.edgePrefilterReady?'Motion prefilter ready; object detector not proven.':'Not proven.'}
          </p>
          {state.homebase?.edgeDetector?.modelLicense?<p className="mt-1 text-muted-foreground">License: {state.homebase.edgeDetector.modelLicense} · approved: {state.homebase.edgeDetector.licenseApproved?'yes':'no'}</p>:null}
          {state.homebase?.edgeDetector?.error?<p className="mt-1 text-destructive">{state.homebase.edgeDetector.error}</p>:null}
        </div>
        <div className="rounded border p-3 text-xs">
          <p className="font-medium">Human ground-truth review</p>
          <p className="mt-1 text-muted-foreground">
            {state.perception?.annotationReview?.reachable
              ?'CVAT is reachable for review/import of candidate annotations.'
              :state.perception?.annotationReview?.configured
                ?'CVAT is configured but not reachable.'
                :'CVAT is optional and not configured.'}
          </p>
          {state.perception?.annotationReview?.version?<p className="mt-1 text-muted-foreground">Version: {state.perception.annotationReview.version}</p>:null}
          {state.perception?.annotationReview?.error&&state.perception.annotationReview.configured?<p className="mt-1 text-destructive">{state.perception.annotationReview.error}</p>:null}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {(Object.keys(LABEL) as Purpose[]).map(purpose=>{
          const item=state.purposeStatus[purpose]
          const receipt=item?.passedReceipt
          return <div className="rounded border p-3 text-xs" key={purpose}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{LABEL[purpose]}</span>
              <span className="rounded border px-1.5 py-0.5 text-[10px] uppercase">{item?.commissioned?'commissioned':'not proven'}</span>
            </div>
            {receipt?<div className="mt-2 text-muted-foreground">
              <p>{String(receipt.provider_id??'provider')} · {String(receipt.persisted_result_count??0)} persisted result{Number(receipt.persisted_result_count??0)===1?'':'s'}</p>
              {receipt.completed_at?<p>{new Date(receipt.completed_at).toLocaleString()}</p>:null}
            </div>:<p className="mt-2 text-muted-foreground">No passed authenticated callback receipt yet.</p>}
            <button
              className="mt-3 rounded border px-2 py-1.5 text-xs disabled:opacity-40"
              disabled={busy||state.runtime?.productionReady!==true}
              onClick={()=>void commission([purpose])}
            >{busy?'Working…':'Commission '+LABEL[purpose]}</button>
          </div>
        })}
      </div>

      {missing.length?<button
        className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40"
        disabled={busy||state.runtime?.productionReady!==true}
        onClick={()=>void commission(missing)}
      >{busy?'Working…':'Commission missing Watch paths'}</button>:<p className="text-xs font-medium">All three Watch paths have authenticated persisted-result proof.</p>}

      {state.runtime?.error?<p className="text-xs text-destructive">{state.runtime.error}</p>:null}
    </div>:null}
    {status?<p className="mt-3 text-xs text-muted-foreground" role="status">{status}</p>:null}
  </section>
}
