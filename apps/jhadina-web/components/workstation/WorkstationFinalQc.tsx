'use client'

import {useCallback,useEffect,useState} from 'react'

type Readiness={
  projectId:string
  format:string
  readyForEvaluation:boolean
  admissible:boolean
  blockers:string[]
  plannedAudioStemRoles:string[]
  executedAudioStemRoles:string[]
  selectedTakeIds:string[]
  rehearsalGraduationReceiptIds:string[]
  rightsEvidenceIds:string[]
  timelineVersionId:string
  finalMasterAssetId:string|null
  evidenceUpdatedAt:string|null
  decision?:{reasons?:string[];admissible?:boolean}|null
}

type PostReceipt={
  taskId:string
  capability:string
  status:string
  outputRefs:string[]
  errorCode:string|null
  completedAt:string
}

export function WorkstationFinalQc({projectId}:{projectId:string}){
  const [readiness,setReadiness]=useState<Readiness|null>(null)
  const [postReceipts,setPostReceipts]=useState<PostReceipt[]>([])
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const response=await fetch('/api/workstation/final-qc?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
    const data=await response.json() as {ok?:boolean;readiness?:Readiness;postReceipts?:PostReceipt[];error?:string}
    if(!response.ok||!data.ok)throw new Error(data.error??'Unable to load final QC readiness')
    setReadiness(data.readiness??null)
    setPostReceipts(data.postReceipts??[])
  },[projectId])

  useEffect(()=>{
    void load().catch(error=>{
      const message=error instanceof Error?error.message:'Unable to load final QC readiness'
      if(message.includes('FORMAT_USES_WHOLE_VIDEO_REVIEW'))return
      setStatus(message)
    })
  },[load])

  async function evaluate(){
    if(busy)return
    setBusy(true);setStatus(null)
    try{
      const response=await fetch('/api/workstation/final-qc',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({projectId}),
      })
      const data=await response.json() as {ok?:boolean;readiness?:Readiness;postReceipts?:PostReceipt[];error?:string}
      if(!response.ok||!data.ok){
        if(data.readiness)setReadiness(data.readiness)
        if(data.postReceipts)setPostReceipts(data.postReceipts)
        throw new Error(data.error??'Final QC evaluation failed')
      }
      setReadiness(data.readiness??null)
      setPostReceipts(data.postReceipts??[])
      setStatus(data.readiness?.admissible
        ?'Final QC admitted this production. Publication is still a separate Social approval.'
        :'Final QC evaluated but did not admit the production.'
      )
    }catch(error){
      setStatus(error instanceof Error?error.message:'Final QC evaluation failed')
    }finally{
      setBusy(false)
    }
  }

  if(!readiness&&!status)return null
  const blockers=readiness?.blockers??[]
  const executed=new Set(readiness?.executedAudioStemRoles??[])

  return <section className="rounded-xl border bg-background p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">AUTO.6 · Final admission</p>
        <h2 className="font-semibold">Production QC readiness</h2>
        <p className="text-xs text-muted-foreground">Provider success is not final quality. Director requires final-watch, coherence, audio, rights, rehearsal and editable-timeline evidence before admission.</p>
      </div>
      <div className="flex gap-2">
        <button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={()=>void load()}>
          Refresh
        </button>
        <button className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40" disabled={busy||!readiness?.readyForEvaluation} onClick={()=>void evaluate()}>
          {busy?'Evaluating…':'Run final QC'}
        </button>
      </div>
    </div>

    {readiness?<div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded border px-2 py-1">Format: {readiness.format.replaceAll('_',' ')}</span>
        <span className="rounded border px-2 py-1">Timeline: {readiness.timelineVersionId}</span>
        <span className="rounded border px-2 py-1">{readiness.selectedTakeIds.length} selected take{readiness.selectedTakeIds.length===1?'':'s'}</span>
        <span className="rounded border px-2 py-1">{readiness.rightsEvidenceIds.length} rights ref{readiness.rightsEvidenceIds.length===1?'':'s'}</span>
        <span className={'rounded border px-2 py-1 '+(readiness.admissible?'font-semibold':'')}>{readiness.admissible?'QC admitted':'Not admitted'}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border p-3 text-xs">
          <p className="font-medium">Final master & watch</p>
          <p className="mt-1 text-muted-foreground">{readiness.finalMasterAssetId??'No final master evidence yet.'}</p>
          <p className="mt-1">{readiness.evidenceUpdatedAt?'Evidence updated '+new Date(readiness.evidenceUpdatedAt).toLocaleString():'No worker final-QC deposit yet.'}</p>
        </div>
        <div className="rounded border p-3 text-xs">
          <p className="font-medium">Executed audio stems</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(readiness.plannedAudioStemRoles.length?readiness.plannedAudioStemRoles:readiness.executedAudioStemRoles).map(role=>
              <span key={role} className="rounded border px-1.5 py-0.5">{role}: {executed.has(role)?'ready':'missing'}</span>
            )}
          </div>
        </div>
      </div>

      {postReceipts.length?<div className="rounded border p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">ONE-RUNTIME post receipts</p>
          <span className="text-[10px] text-muted-foreground">{postReceipts.filter(item=>item.status==='succeeded').length}/{postReceipts.length} succeeded</span>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {postReceipts.map(receipt=><div key={receipt.taskId} className="rounded border p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{receipt.capability.replace('director.','')}</span>
              <span className="rounded border px-1.5 py-0.5 text-[10px] uppercase">{receipt.status}</span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">{receipt.outputRefs.length} output ref{receipt.outputRefs.length===1?'':'s'} · {new Date(receipt.completedAt).toLocaleString()}</p>
            {receipt.errorCode?<p className="mt-1 text-[10px] text-destructive">{receipt.errorCode}</p>:null}
          </div>)}
        </div>
      </div>:null}

      {blockers.length?<div className="rounded border p-3 text-xs">
        <p className="font-medium">Final-QC blockers</p>
        <div className="mt-2 grid gap-1 text-muted-foreground">
          {blockers.map(blocker=><div key={blocker}>{blocker}</div>)}
        </div>
      </div>:<div className="rounded border p-3 text-xs">
        <p className="font-medium">{readiness.admissible?'Production admitted':'All evidence is present; final evaluation can run.'}</p>
      </div>}
    </div>:null}

    {status?<p className="mt-3 text-xs text-muted-foreground" role="status">{status}</p>:null}
  </section>
}
