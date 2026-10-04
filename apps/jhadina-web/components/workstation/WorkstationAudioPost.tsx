'use client'

import {useCallback,useEffect,useState} from 'react'

type AudioPlan={
  id:string
  status:string
  blockers:string[]
  required_worker_profiles:string[]
  ready_worker_profiles:string[]
  post_plan?:{
    speechSegments?:Array<{id:string;role:string;characterId:string;text:string;startSeconds:number;endSeconds:number}>
    captions?:{required?:boolean;segments?:unknown[];timing?:string}
    soundtrackBrief?:{purpose?:string;moodTags?:string[];styleTags?:string[];variationCount?:number}
    foleyPlan?:{events?:Array<{id:string;action:string;startSeconds:number;endSeconds:number}>}
    stems?:{roles?:string[];preserveSeparateFiles?:boolean}
    lipSync?:{required?:boolean;mode?:string;sourceAudioArtifacts?:string[]}
  }
}

export function WorkstationAudioPost({projectId}:{projectId:string}){
  const [plan,setPlan]=useState<AudioPlan|null>(null)
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const response=await fetch('/api/workstation/audio-post?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
    const data=await response.json() as {ok?:boolean;plan?:AudioPlan|null;error?:string}
    if(!response.ok||!data.ok)throw new Error(data.error??'Unable to load audio-post plan')
    setPlan(data.plan??null)
  },[projectId])

  useEffect(()=>{void load().catch(error=>setStatus(error instanceof Error?error.message:'Unable to load audio-post plan'))},[load])

  async function compile(){
    if(busy)return
    setBusy(true);setStatus(null)
    try{
      const response=await fetch('/api/workstation/audio-post',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId}),
      })
      const data=await response.json() as {ok?:boolean;error?:string;result?:{status?:string;blockers?:string[]}}
      if(!response.ok||!data.ok)throw new Error(data.error??'Unable to compile audio-post plan')
      await load()
      const blockers=data.result?.blockers?.length??0
      setStatus(blockers
        ?'Audio post plan compiled. '+blockers+' runtime/provider blocker'+(blockers===1?' remains.':'s remain.')
        :'Audio post plan compiled and ready for execution.'
      )
    }catch(error){
      setStatus(error instanceof Error?error.message:'Unable to compile audio-post plan')
    }finally{setBusy(false)}
  }

  return <section className="rounded-xl border bg-background p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">AUTO.5 · Post sound</p>
        <h2 className="font-semibold">Narration · music · Foley · captions · lip sync</h2>
        <p className="text-xs text-muted-foreground">Director compiles every required audio layer against the canonical rough cut. Missing workers stay visible instead of being silently skipped.</p>
      </div>
      <button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={()=>void compile()}>
        {busy?'Compiling…':plan?'Refresh audio plan':'Compile audio plan'}
      </button>
    </div>

    {plan?<div className="mt-3 space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded border px-2 py-1">Status: {plan.status.replaceAll('_',' ')}</span>
        <span className="rounded border px-2 py-1">{plan.post_plan?.speechSegments?.length??0} speech segment{(plan.post_plan?.speechSegments?.length??0)===1?'':'s'}</span>
        <span className="rounded border px-2 py-1">{plan.post_plan?.foleyPlan?.events?.length??0} Foley event{(plan.post_plan?.foleyPlan?.events?.length??0)===1?'':'s'}</span>
        <span className="rounded border px-2 py-1">{plan.post_plan?.stems?.roles?.length??0} editable stem roles</span>
      </div>

      {plan.post_plan?.soundtrackBrief?<div className="rounded border p-3 text-xs">
        <p className="font-medium">Music brief</p>
        <p className="mt-1 text-muted-foreground">{plan.post_plan.soundtrackBrief.purpose}</p>
        <p className="mt-1">Mood: {(plan.post_plan.soundtrackBrief.moodTags??[]).join(' · ')} · {plan.post_plan.soundtrackBrief.variationCount??0} candidates</p>
      </div>:null}

      {plan.post_plan?.lipSync?.required?<div className="rounded border p-3 text-xs">
        <p className="font-medium">Lip sync required</p>
        <p className="mt-1 text-muted-foreground">{plan.post_plan.lipSync.mode}</p>
      </div>:null}

      {plan.blockers?.length?<div className="rounded border p-3 text-xs">
        <p className="font-medium">Execution blockers</p>
        <div className="mt-1 space-y-1 text-muted-foreground">{plan.blockers.map(blocker=><div key={blocker}>{blocker}</div>)}</div>
      </div>:null}
    </div>:null}
    {status?<p className="mt-3 text-xs text-muted-foreground" role="status">{status}</p>:null}
  </section>
}
