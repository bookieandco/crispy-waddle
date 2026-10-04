'use client'

import {useCallback,useEffect,useState} from 'react'

type Phase={
  phase:string
  state:'verified'|'waiting'|'blocked'|'not-applicable'
  evidence:string[]
  note:string
}
type Receipt={
  projectId:string
  planId:string
  format:string
  opportunityId:string
  furthestVerifiedPhase:string
  nextBoundary:string
  productionReadyForSocialProposal:boolean
  phases:Phase[]
}

export function WorkstationBusinessCanary({projectId}:{projectId:string}){
  const [receipt,setReceipt]=useState<Receipt|null>(null)
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const response=await fetch('/api/workstation/business-canary?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
    const data=await response.json() as {ok?:boolean;receipt?:Receipt;error?:string}
    if(!response.ok||!data.ok)throw new Error(data.error??'Unable to inspect Director business canary')
    setReceipt(data.receipt??null)
  },[projectId])

  useEffect(()=>{
    void load().catch(error=>{
      const message=error instanceof Error?error.message:'Unable to inspect Director business canary'
      if(message.includes('CONTEXT_NOT_FOUND'))return
      setStatus(message)
    })
  },[load])

  async function certify(){
    if(busy)return
    setBusy(true);setStatus(null)
    try{
      const response=await fetch('/api/workstation/business-canary',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({projectId}),
      })
      const data=await response.json() as {ok?:boolean;receipt?:Receipt;error?:string}
      if(!response.ok||!data.ok)throw new Error(data.error??'Unable to certify Director business canary')
      setReceipt(data.receipt??null)
      setStatus(data.receipt?.productionReadyForSocialProposal
        ?'End-to-end production receipt certified. The final master is eligible for a Social proposal; publication approval is still separate.'
        :'Progress receipt certified at '+String(data.receipt?.furthestVerifiedPhase??'current phase')+'.'
      )
    }catch(error){
      setStatus(error instanceof Error?error.message:'Unable to certify Director business canary')
    }finally{
      setBusy(false)
    }
  }

  if(!receipt&&!status)return null

  return <section className="rounded-xl border bg-background p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">AUTO.10 · End-to-end canary</p>
        <h2 className="font-semibold">Business Factory → Director → Social readiness</h2>
        <p className="text-xs text-muted-foreground">Read-only evidence of the production chain. A passing canary does not approve publishing or paid media.</p>
      </div>
      <div className="flex gap-2">
        <button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={()=>void load()}>Refresh</button>
        <button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy||!receipt} onClick={()=>void certify()}>
          {busy?'Certifying…':'Write canary receipt'}
        </button>
      </div>
    </div>

    {receipt?<div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded border px-2 py-1">Format: {receipt.format.replaceAll('_',' ')}</span>
        <span className="rounded border px-2 py-1">Reached: {receipt.furthestVerifiedPhase}</span>
        <span className="rounded border px-2 py-1">Next: {receipt.nextBoundary}</span>
        <span className={'rounded border px-2 py-1 '+(receipt.productionReadyForSocialProposal?'font-semibold':'')}>
          {receipt.productionReadyForSocialProposal?'Social-proposal eligible':'Not Social-ready'}
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {receipt.phases.map(item=><div key={item.phase} className="rounded border p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{item.phase.replaceAll('-',' ')}</span>
            <span className="rounded border px-1.5 py-0.5 text-[10px] uppercase">{item.state}</span>
          </div>
          <p className="mt-1 text-muted-foreground">{item.note}</p>
          {item.evidence.length?<p className="mt-1 text-[10px] text-muted-foreground">{item.evidence.length} evidence ref{item.evidence.length===1?'':'s'}</p>:null}
        </div>)}
      </div>
    </div>:null}
    {status?<p className="mt-3 text-xs text-muted-foreground" role="status">{status}</p>:null}
  </section>
}
