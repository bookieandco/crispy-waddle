'use client'

import {useCallback,useEffect,useState} from 'react'

type Take={
  takeId:string
  assetId:string
  score:number
  admissible:boolean
  reasons:string[]
  evidenceIds:string[]
  observationIds:string[]
  selected:boolean
  alternate:boolean
  approved:boolean
  approvalId:string|null
  previewUrl:string|null
  mimeType:string|null
  mediaType:string|null
}
type TakeSet={
  takeGroupId:string
  policyId:string
  status:string
  selectedTakeId:string|null
  selectedAssetId:string|null
  alternateTakeIds:string[]
  evidenceIds:string[]
  board:{id:string;shotId:string;title:string|null;description:string|null;ordinal:number}|null
  takes:Take[]
  updatedAt:string
}

export function WorkstationTakeSets({projectId}:{projectId:string}){
  const [sets,setSets]=useState<TakeSet[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [approving,setApproving]=useState<string|null>(null)

  const load=useCallback(async()=>{
    setLoading(true)
    setError(null)
    try{
      const response=await fetch('/api/workstation/take-sets?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
      const data=await response.json() as {ok?:boolean;sets?:TakeSet[];error?:string}
      if(!response.ok||!data.ok)throw new Error(data.error??'Unable to load Director take sets')
      setSets(data.sets??[])
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Unable to load Director take sets')
    }finally{
      setLoading(false)
    }
  },[projectId])

  useEffect(()=>{void load()},[load])

  async function approve(assetId:string){
    setApproving(assetId)
    setError(null)
    try{
      const response=await fetch('/api/workstation/editing-assets',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({projectId,assetId}),
      })
      const data=await response.json() as {ok?:boolean;error?:string}
      if(!response.ok||!data.ok)throw new Error(data.error??'Unable to approve selected take')
      await load()
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Unable to approve selected take')
    }finally{
      setApproving(null)
    }
  }

  return <section className="rounded-xl border bg-background p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold">Director takes</h2>
        <p className="text-xs text-muted-foreground">Evidence-selected winner plus preserved backup takes. Selection does not approve an asset for timeline use.</p>
      </div>
      <button className="rounded border px-2 py-1 text-xs disabled:opacity-50" disabled={loading} onClick={()=>void load()}>
        {loading?'Refreshing…':'Refresh'}
      </button>
    </div>
    {error?<p className="mt-3 rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error}</p>:null}
    {!loading&&sets.length===0?<p className="mt-3 text-sm text-muted-foreground">No completed take selections yet.</p>:null}
    <div className="mt-4 space-y-4">
      {sets.map(set=><article key={set.takeGroupId} className="rounded-lg border p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Shot {set.board?.ordinal??'—'} · {set.policyId}</p>
            <h3 className="font-medium">{set.board?.title??set.board?.shotId??set.takeGroupId}</h3>
            {set.board?.description?<p className="mt-1 text-xs text-muted-foreground">{set.board.description}</p>:null}
          </div>
          <span className="rounded border px-2 py-1 text-[11px] uppercase">{set.status}</span>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          {set.takes.map(take=><div key={take.takeId} className={'rounded-lg border p-2 '+(take.selected?'ring-2 ring-primary':'')}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium">{take.selected?'Selected winner':take.alternate?'Backup take':'Candidate'}</p>
                <p className="text-[11px] text-muted-foreground">{take.takeId}</p>
              </div>
              <span className="text-xs font-semibold">{Number.isFinite(take.score)?take.score.toFixed(3):'—'}</span>
            </div>
            {take.previewUrl?<video className="mt-2 aspect-video w-full rounded border bg-black" src={take.previewUrl} controls preload="metadata"/>:<div className="mt-2 flex aspect-video items-center justify-center rounded border bg-muted text-xs text-muted-foreground">Preview unavailable</div>}
            <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
              <span className="rounded border px-1.5 py-0.5">{take.admissible?'QC admissible':'QC blocked'}</span>
              <span className="rounded border px-1.5 py-0.5">{take.approved?'Approved for edit':'Not approved'}</span>
              <span className="rounded border px-1.5 py-0.5">{take.evidenceIds.length} evidence refs</span>
            </div>
            {take.reasons.length?<div className="mt-2 text-[11px] text-muted-foreground">{take.reasons.slice(0,4).join(' · ')}</div>:null}
            {take.selected&&!take.approved?<button className="mt-2 rounded bg-primary px-2 py-1.5 text-xs text-primary-foreground disabled:opacity-50" disabled={approving===take.assetId} onClick={()=>void approve(take.assetId)}>
              {approving===take.assetId?'Approving…':'Approve winner for edit'}
            </button>:null}
          </div>)}
        </div>
      </article>)}
    </div>
  </section>
}
