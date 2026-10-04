'use client'

import {useCallback,useEffect,useState} from 'react'

type Proposal={
  id:string
  status:'proposed'|'awaiting_asset_approval'|'materialized'|'stale'|'blocked'
  selected_asset_ids:string[]
  required_approval_asset_ids:string[]
  timeline_revision?:number|null
  error?:string|null
  proposal?:{
    pictureDurationSeconds?:number
    targetDurationSeconds?:number
    limitations?:string[]
    selectedTakes?:Array<{
      boardId?:string
      selectedTakeId?:string
      selectedAssetId?:string
      alternateTakeIds?:string[]
    }>
  }
}

export function WorkstationRoughCut({projectId}:{projectId:string}){
  const [proposal,setProposal]=useState<Proposal|null>(null)
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const response=await fetch('/api/workstation/rough-cut?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
    const data=await response.json() as {ok?:boolean;proposal?:Proposal|null;error?:string}
    if(!response.ok||!data.ok)throw new Error(data.error??'Unable to load rough-cut proposal')
    setProposal(data.proposal??null)
  },[projectId])

  useEffect(()=>{void load().catch(error=>setStatus(error instanceof Error?error.message:'Unable to load rough-cut proposal'))},[load])

  async function action(kind:'propose'|'materialize'){
    if(busy)return
    setBusy(true);setStatus(null)
    try{
      const response=await fetch('/api/workstation/rough-cut',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({projectId,action:kind}),
      })
      const data=await response.json() as {ok?:boolean;error?:string;result?:{revision?:number;status?:string}}
      if(!response.ok||!data.ok)throw new Error(data.error??'Rough-cut action failed')
      await load()
      setStatus(kind==='propose'
        ?'Rough cut proposed from evidence-selected takes.'
        :'Rough cut materialized into the canonical Workstation timeline at revision '+String(data.result?.revision??'?')+'.'
      )
    }catch(error){
      setStatus(error instanceof Error?error.message:'Rough-cut action failed')
    }finally{setBusy(false)}
  }

  async function approveSelectedAssets(){
    const ids=proposal?.required_approval_asset_ids??[]
    if(!ids.length)return
    setBusy(true);setStatus(null)
    try{
      for(const assetId of ids){
        const response=await fetch('/api/workstation/editing-assets',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({projectId,assetId}),
        })
        const data=await response.json() as {ok?:boolean;error?:string}
        if(!response.ok||!data.ok)throw new Error(data.error??('Unable to approve '+assetId))
      }
      await action('propose')
      setStatus('Selected takes approved for editing. The rough cut is ready to materialize.')
    }catch(error){
      setStatus(error instanceof Error?error.message:'Unable to approve selected takes')
      setBusy(false)
    }
  }

  return <section className="rounded-xl border bg-background p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Automatic edit assembly</p>
        <h2 className="font-semibold">Evidence-selected rough cut</h2>
        <p className="text-xs text-muted-foreground">Director orders winner takes by screenplay/storyboard lineage. Backups stay preserved. Canonical timeline insertion remains approval- and revision-fenced.</p>
      </div>
      {!proposal?<button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={()=>void action('propose')}>
        {busy?'Building…':'Build rough-cut proposal'}
      </button>:null}
    </div>

    {proposal?<div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded border px-2 py-1">Status: {proposal.status.replaceAll('_',' ')}</span>
        <span className="rounded border px-2 py-1">{proposal.selected_asset_ids?.length??0} selected takes</span>
        <span className="rounded border px-2 py-1">{proposal.proposal?.pictureDurationSeconds?.toFixed?.(1)??'?'}s picture / {proposal.proposal?.targetDurationSeconds??'?'}s target</span>
      </div>

      {proposal.proposal?.selectedTakes?.length?<div className="grid gap-2 md:grid-cols-2">
        {proposal.proposal.selectedTakes.slice(0,12).map((take,index)=><div key={(take.boardId??'take')+index} className="rounded border p-2 text-xs">
          <p className="font-medium">{take.selectedTakeId??take.selectedAssetId}</p>
          <p className="text-muted-foreground">{take.boardId}</p>
          {take.alternateTakeIds?.length?<p className="mt-1">Backups preserved: {take.alternateTakeIds.length}</p>:null}
        </div>)}
      </div>:null}

      {proposal.required_approval_asset_ids?.length?<div className="rounded border p-3">
        <p className="text-xs font-medium">{proposal.required_approval_asset_ids.length} selected asset{proposal.required_approval_asset_ids.length===1?' needs':'s need'} editing approval.</p>
        <button className="mt-2 rounded border px-3 py-1.5 text-sm disabled:opacity-40" disabled={busy} onClick={()=>void approveSelectedAssets()}>
          {busy?'Approving…':'Approve selected takes for this rough cut'}
        </button>
      </div>:null}

      {proposal.proposal?.limitations?.length?<div className="rounded border p-3 text-xs">
        <p className="font-medium">Assembly notes</p>
        <p className="mt-1 text-muted-foreground">{proposal.proposal.limitations.join(' · ')}</p>
      </div>:null}

      <div className="flex flex-wrap gap-2">
        <button className="rounded border px-3 py-1.5 text-sm disabled:opacity-40" disabled={busy} onClick={()=>void action('propose')}>Refresh proposal</button>
        {proposal.status==='proposed'&&!proposal.required_approval_asset_ids?.length?<button className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-40" disabled={busy} onClick={()=>void action('materialize')}>
          Materialize in Workstation
        </button>:null}
      </div>
    </div>:null}
    {status?<p className="mt-3 text-xs text-muted-foreground" role="status">{status}</p>:null}
  </section>
}
