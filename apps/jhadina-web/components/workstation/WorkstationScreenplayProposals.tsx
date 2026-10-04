'use client'

import {useCallback,useEffect,useState} from 'react'

type ProposalRecord={
  id:string
  artifact_id:string
  status:'proposed'|'accepted'|'rejected'|'superseded'
  proposal?:{
    title?:string
    scenes?:Array<{id?:string;order?:number;interiorExterior?:string;location?:string;timeOfDay?:string;action?:string[];dialogue?:unknown[]}>
    blockers?:string[]
    warnings?:string[]
    authority?:string
  }
  created_at:string
}

export function WorkstationScreenplayProposals({projectId}:{projectId:string}){
  const [items,setItems]=useState<ProposalRecord[]>([])
  const [busy,setBusy]=useState<string|null>(null)
  const [status,setStatus]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const response=await fetch('/api/workstation/screenplay?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
    const data=await response.json() as {ok?:boolean;proposals?:ProposalRecord[];error?:string}
    if(!response.ok||!data.ok)throw new Error(data.error??'Unable to load screenplay proposals')
    setItems(data.proposals??[])
  },[projectId])

  useEffect(()=>{void load().catch(error=>setStatus(error instanceof Error?error.message:'Unable to load screenplay proposals'))},[load])

  async function accept(proposalId:string){
    setBusy(proposalId);setStatus(null)
    try{
      const response=await fetch('/api/workstation/screenplay',{
        method:'PUT',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({projectId,proposalId}),
      })
      const data=await response.json() as {ok?:boolean;error?:string;alreadyAccepted?:boolean}
      if(!response.ok||!data.ok)throw new Error(data.error??'Unable to accept screenplay blueprint')
      await load()
      setStatus(data.alreadyAccepted?'Screenplay blueprint was already accepted.':'Screenplay blueprint accepted. Storyboard and shot-list planning are now eligible.')
    }catch(error){
      setStatus(error instanceof Error?error.message:'Unable to accept screenplay blueprint')
    }finally{
      setBusy(null)
    }
  }

  if(!items.length&&!status)return null

  return <section className="rounded-xl border bg-background p-4">
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Screenplay intelligence</p>
      <h2 className="font-semibold">Parsed screenplay proposals</h2>
      <p className="text-xs text-muted-foreground">Jhadina can propose structure, but only an explicitly accepted proposal becomes the canonical screenplay blueprint for storyboard/shot orchestration.</p>
    </div>
    <div className="mt-3 grid gap-3">
      {items.map(item=>{
        const scenes=item.proposal?.scenes??[]
        const blockers=item.proposal?.blockers??[]
        const warnings=item.proposal?.warnings??[]
        return <article key={item.id} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{item.proposal?.title||'Screenplay proposal'}</p>
              <p className="text-xs text-muted-foreground">{scenes.length} scene{scenes.length===1?'':'s'} detected · {item.status}</p>
            </div>
            {item.status==='proposed'?<button
              className="rounded border px-2 py-1 text-xs disabled:opacity-40"
              disabled={busy!==null||blockers.length>0}
              onClick={()=>void accept(item.id)}
            >{busy===item.id?'Accepting…':'Accept blueprint'}</button>:null}
          </div>
          {blockers.length?<div className="mt-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs">
            <strong>Needs review before acceptance:</strong> {blockers.join(' · ')}
          </div>:null}
          {warnings.length?<p className="mt-2 text-xs text-muted-foreground">Warnings: {warnings.join(' · ')}</p>:null}
          {scenes.length?<div className="mt-2 grid gap-1 text-xs text-muted-foreground">
            {scenes.slice(0,8).map((scene,index)=><div key={scene.id??index}>
              {scene.order??index+1}. {scene.interiorExterior??''} {scene.location??'UNSPECIFIED'} · {scene.timeOfDay??'UNSPECIFIED'}
            </div>)}
            {scenes.length>8?<div>+ {scenes.length-8} more scenes</div>:null}
          </div>:null}
        </article>
      })}
    </div>
    {status?<p className="mt-3 text-xs text-muted-foreground" role="status">{status}</p>:null}
  </section>
}
