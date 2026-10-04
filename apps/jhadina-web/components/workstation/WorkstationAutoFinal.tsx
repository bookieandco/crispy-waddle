'use client'

import {useCallback,useEffect,useState} from 'react'

type Receipt={
  projectId:string
  planId:string
  format:string
  admissible:boolean
  reasons:string[]
  evidence:{
    productionRunId:string
    automationStatus:string
    timelineRevision:number
    timelineVersionId:string
    autopilot:{present:boolean;status:string|null;boundary:string|null;observedAt:string|null}
    watch:{
      liveRuntimeReady:boolean
      cloudRuntimeReady:boolean
      homebaseRuntimeReady:boolean
      purposes:Record<string,{commissioned:boolean;jobId:string|null;completedAt:string|null;persistedResultCount:number}>
    }
    finalQc:{
      required:boolean
      admissible:boolean
      persistedAdmissionReceipt:boolean
      finalMasterAssetId:string|null
      blockers:string[]
    }
    canary:{
      productionReadyForSocialProposal:boolean
      furthestVerifiedPhase:string
      nextBoundary:string
    }
  }
}

export function WorkstationAutoFinal({projectId}:{projectId:string}){
  const [receipt,setReceipt]=useState<Receipt|null>(null)
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const response=await fetch('/api/workstation/auto-final?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
    const data=await response.json() as {ok?:boolean;receipt?:Receipt;error?:string}
    if(!response.ok||!data.ok)throw new Error(data.error??'Unable to inspect DIRECTOR-AUTO.FINAL')
    setReceipt(data.receipt??null)
  },[projectId])

  useEffect(()=>{
    void load().catch(error=>{
      const message=error instanceof Error?error.message:'Unable to inspect DIRECTOR-AUTO.FINAL'
      if(message.includes('CONTEXT_NOT_FOUND'))return
      setStatus(message)
    })
  },[load])

  async function certify(){
    if(busy)return
    setBusy(true);setStatus(null)
    try{
      const response=await fetch('/api/workstation/auto-final',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({projectId}),
      })
      const data=await response.json() as {ok?:boolean;receipt?:Receipt;error?:string}
      if(!response.ok||!data.ok)throw new Error(data.error??'Unable to certify DIRECTOR-AUTO.FINAL')
      setReceipt(data.receipt??null)
      setStatus(data.receipt?.admissible
        ?'DIRECTOR-AUTO.FINAL certified for this project. Social publication approval remains separate.'
        :'Closure receipt written with the current blockers preserved.'
      )
    }catch(error){
      setStatus(error instanceof Error?error.message:'Unable to certify DIRECTOR-AUTO.FINAL')
    }finally{
      setBusy(false)
    }
  }

  if(!receipt&&!status)return null
  const watchEntries=Object.entries(receipt?.evidence.watch.purposes??{})

  return <section className="rounded-xl border bg-background p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">DIRECTOR-AUTO.FINAL</p>
        <h2 className="font-semibold">Autonomous production closure</h2>
        <p className="text-xs text-muted-foreground">Project-scoped evidence only. This receipt cannot approve creative, publish, spend, or wager.</p>
      </div>
      <div className="flex gap-2">
        <button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={()=>void load()}>Refresh</button>
        <button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy||!receipt} onClick={()=>void certify()}>
          {busy?'Certifying…':'Write FINAL receipt'}
        </button>
      </div>
    </div>

    {receipt?<div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded border px-2 py-1">Format: {receipt.format.replaceAll('_',' ')}</span>
        <span className="rounded border px-2 py-1">Timeline r{receipt.evidence.timelineRevision}</span>
        <span className="rounded border px-2 py-1">Autopilot: {receipt.evidence.autopilot.status??'no receipt'}</span>
        <span className="rounded border px-2 py-1">Watch runtime: {receipt.evidence.watch.liveRuntimeReady?'live':'not live'}</span>
        <span className="rounded border px-2 py-1">Final QC: {receipt.evidence.finalQc.required?(receipt.evidence.finalQc.admissible?'admitted':'not admitted'):'not required'}</span>
        <span className={'rounded border px-2 py-1 '+(receipt.admissible?'font-semibold':'')}>
          {receipt.admissible?'FINAL certified':'FINAL blocked'}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded border p-3 text-xs">
          <p className="font-medium">Watch paths</p>
          <div className="mt-2 space-y-1 text-muted-foreground">
            {watchEntries.map(([purpose,item])=><div key={purpose}>{purpose}: {item.commissioned?'commissioned':'missing'} · {item.persistedResultCount} result{item.persistedResultCount===1?'':'s'}</div>)}
          </div>
        </div>
        <div className="rounded border p-3 text-xs">
          <p className="font-medium">Final master</p>
          <p className="mt-2 text-muted-foreground">{receipt.evidence.finalQc.finalMasterAssetId??'No admitted final master.'}</p>
          <p className="mt-1">Persisted QC receipt: {receipt.evidence.finalQc.persistedAdmissionReceipt?'yes':'no'}</p>
        </div>
        <div className="rounded border p-3 text-xs">
          <p className="font-medium">Business canary</p>
          <p className="mt-2 text-muted-foreground">Reached: {receipt.evidence.canary.furthestVerifiedPhase}</p>
          <p className="mt-1">Next: {receipt.evidence.canary.nextBoundary}</p>
          <p className="mt-1">Social-proposal ready: {receipt.evidence.canary.productionReadyForSocialProposal?'yes':'no'}</p>
        </div>
      </div>

      {receipt.reasons.length?<div className="rounded border p-3 text-xs">
        <p className="font-medium">Closure blockers</p>
        <div className="mt-2 grid gap-1 text-muted-foreground">
          {receipt.reasons.map(reason=><div key={reason}>{reason}</div>)}
        </div>
      </div>:<div className="rounded border p-3 text-xs font-medium">All DIRECTOR-AUTO.FINAL evidence is aligned for this project.</div>}
    </div>:null}
    {status?<p className="mt-3 text-xs text-muted-foreground" role="status">{status}</p>:null}
  </section>
}
