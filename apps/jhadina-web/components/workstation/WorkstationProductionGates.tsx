'use client'

import {useCallback,useEffect,useState} from 'react'

type Gate={
  id:string
  kind:'storyboard'|'shotlist'|'generation'
  decision:string
  requested_at?:string|null
  decided_at?:string|null
  note?:string|null
}
type Stage={
  id:string
  kind:string
  status:string
  output_artifact_ids?:string[]|null
}
type GateState={
  automationStatus:string
  gates:Gate[]
  stages:Stage[]
  boards:Array<{id:string;ordinal:number;title?:string|null;description?:string|null;status?:string}>
}

export function WorkstationProductionGates({projectId}:{projectId:string}){
  const [state,setState]=useState<GateState|null>(null)
  const [busy,setBusy]=useState<string|null>(null)
  const [status,setStatus]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const response=await fetch('/api/workstation/production-gates?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
    const data=await response.json() as {ok?:boolean;error?:string;gates?:Gate[];stages?:Stage[];boards?:GateState['boards'];automationStatus?:string}
    if(!response.ok||!data.ok)throw new Error(data.error??'Unable to load production gates')
    setState({
      automationStatus:data.automationStatus??'planned',
      gates:data.gates??[],
      stages:data.stages??[],
      boards:data.boards??[],
    })
  },[projectId])

  useEffect(()=>{
    void load().catch(error=>{
      const message=error instanceof Error?error.message:'Unable to load production gates'
      if(message.includes('CONTEXT_NOT_FOUND'))return
      setStatus(message)
    })
  },[load])

  async function approve(gate:Gate){
    if(busy)return
    setBusy(gate.id);setStatus(null)
    try{
      const response=await fetch('/api/workstation/production-gates',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({projectId,gateId:gate.id}),
      })
      const data=await response.json() as {ok?:boolean;error?:string;nextBoundary?:string}
      if(!response.ok||!data.ok)throw new Error(data.error??'Unable to approve production gate')
      await load()
      setStatus(gate.kind+' approved. Next boundary: '+String(data.nextBoundary??'Director autopilot reconciliation')+'.')
    }catch(error){
      setStatus(error instanceof Error?error.message:'Unable to approve production gate')
    }finally{
      setBusy(null)
    }
  }

  if(!state&&!status)return null
  const stage=(kind:string)=>state?.stages.find(item=>item.kind===kind)
  const evidence=(kind:string)=>stage(kind)?.output_artifact_ids?.length??0

  return <section className="rounded-xl border bg-background p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Production authority</p>
        <h2 className="font-semibold">Storyboard · rehearsal · generation gates</h2>
        <p className="text-xs text-muted-foreground">Autopilot stops here for owner decisions. Approval is scoped to the exact durable project/run and does not grant publication or paid-media authority.</p>
      </div>
      <button className="rounded border px-2 py-1 text-xs" onClick={()=>void load()}>Refresh</button>
    </div>

    {state?<div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded border px-2 py-1">Autopilot: {state.automationStatus.replaceAll('_',' ')}</span>
        <span className="rounded border px-2 py-1">Previs: {stage('previs')?.status??'not ready'} · {evidence('previs')} evidence</span>
        <span className="rounded border px-2 py-1">Rehearsal: {stage('rehearsal')?.status??'not ready'} · {evidence('rehearsal')} evidence</span>
      </div>

      {state.boards.length?<details className="rounded border p-3 text-xs">
        <summary className="cursor-pointer font-medium">{state.boards.length} storyboard board{state.boards.length===1?'':'s'}</summary>
        <div className="mt-2 grid gap-1 text-muted-foreground">
          {state.boards.slice(0,16).map(board=><div key={board.id}>{board.ordinal}. {board.title??board.id} · {board.status??'draft'}</div>)}
          {state.boards.length>16?<div>+ {state.boards.length-16} more</div>:null}
        </div>
      </details>:null}

      <div className="grid gap-2 md:grid-cols-3">
        {state.gates.map(gate=>{
          const generationBlocked=gate.kind==='generation'&&!(
            stage('previs')?.status==='approved'&&evidence('previs')>0&&
            stage('rehearsal')?.status==='approved'&&evidence('rehearsal')>0
          )
          return <div key={gate.id} className="rounded border p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium capitalize">{gate.kind}</span>
              <span className="rounded border px-1.5 py-0.5 uppercase text-[10px]">{gate.decision}</span>
            </div>
            {generationBlocked?<p className="mt-2 text-muted-foreground">Requires approved previs + rehearsal evidence first.</p>:null}
            {gate.decision==='pending'?<button
              className="mt-3 rounded bg-primary px-2 py-1.5 text-xs text-primary-foreground disabled:opacity-40"
              disabled={busy!==null||generationBlocked}
              onClick={()=>void approve(gate)}
            >{busy===gate.id?'Approving…':'Approve '+gate.kind}</button>:null}
          </div>
        })}
      </div>
    </div>:null}
    {status?<p className="mt-3 text-xs text-muted-foreground" role="status">{status}</p>:null}
  </section>
}
