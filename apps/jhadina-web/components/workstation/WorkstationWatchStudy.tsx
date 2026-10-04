'use client'

import {useCallback,useEffect,useState} from 'react'

type MediaType='youtube'|'movie'|'music'|'jhadina_work'
type SourceKind='authorized-stream'|'hls'|'dash'|'homebase-capture'|'local-file'|'rtsp'|'capture'
type WatchJob={
  id:string
  purpose:'creative'|'sports'
  media_id?:string|null
  source_kind:string
  status:string
  result_count:number
  error?:string|null
  updated_at:string
}

export function WorkstationWatchStudy(){
  const [title,setTitle]=useState('')
  const [sourceUri,setSourceUri]=useState('')
  const [mediaType,setMediaType]=useState<MediaType>('movie')
  const [sourceKind,setSourceKind]=useState<SourceKind>('authorized-stream')
  const [background,setBackground]=useState(false)
  const [cadenceMinutes,setCadenceMinutes]=useState(180)
  const [jobs,setJobs]=useState<WatchJob[]>([])
  const [commissioning,setCommissioning]=useState<{
    configured:boolean
    anyCommissioned:boolean
    allCommissioned?:boolean
    runtime?:{reachable?:boolean;productionReady?:boolean;source?:string;error?:string}
    purposeStatus?:Record<string,{commissioned?:boolean;receipt?:{completed_at?:string;result_count?:number;status?:string;error?:string}|null}>
  }|null>(null)
  const [commissioningRun,setCommissioningRun]=useState(false)
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const [jobResponse,commissionResponse]=await Promise.all([
      fetch('/api/director/watch-jobs?purpose=creative',{cache:'no-store'}),
      fetch('/api/director/watch-jobs/commissioning',{cache:'no-store'}),
    ])
    const data=await jobResponse.json() as {ok?:boolean;jobs?:WatchJob[];error?:string}
    const commissionData=await commissionResponse.json() as {
      ok?:boolean
      error?:string
      configured?:boolean
      anyCommissioned?:boolean
      allCommissioned?:boolean
      runtime?:{reachable?:boolean;productionReady?:boolean;source?:string;error?:string}
      purposeStatus?:Record<string,{commissioned?:boolean;receipt?:{completed_at?:string;result_count?:number;status?:string;error?:string}|null}>
    }
    if(!jobResponse.ok||!data.ok)throw new Error(data.error??'Unable to load Director Watch jobs')
    if(!commissionResponse.ok||!commissionData.ok)throw new Error(commissionData.error??'Unable to load Director Watch commissioning')
    setJobs(data.jobs??[])
    setCommissioning({
      configured:Boolean(commissionData.configured),
      anyCommissioned:Boolean(commissionData.anyCommissioned),
      allCommissioned:Boolean(commissionData.allCommissioned),
      runtime:commissionData.runtime,
      purposeStatus:commissionData.purposeStatus,
    })
  },[])

  useEffect(()=>{void load().catch(error=>setStatus(error instanceof Error?error.message:'Unable to load Director Watch jobs'))},[load])

  async function study(){
    if(!title.trim()||!sourceUri.trim()||busy)return
    setBusy(true);setStatus(null)
    try{
      const homebase=['homebase-capture','local-file','rtsp','capture'].includes(sourceKind)
      const recurring=background||homebase
      const mediaId='media:'+crypto.randomUUID()
      const register=await fetch('/api/director/media-study',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          action:'register_media',
          media:{
            id:mediaId,
            type:mediaType,
            title:title.trim(),
            sourceUri:sourceUri.trim(),
            provenance:{
              provider:'owner-authorized-reference',
              sourceUri:sourceUri.trim(),
              authorized:true,
              observedAt:new Date().toISOString(),
            },
          },
        }),
      })
      const registerData=await register.json() as {ok?:boolean;error?:string}
      if(!register.ok||!registerData.ok)throw new Error(registerData.error??'Unable to register media reference')

      if(recurring){
        const source=await fetch('/api/director/watch-sources',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({
            purpose:'creative',
            label:title.trim(),
            mediaType,
            mediaId,
            sourceKind,
            sourceLocator:sourceUri.trim(),
            executionTarget:homebase?'homebase':'cloud',
            rightsVerified:true,
            sourceAuthorized:true,
            cadenceMinutes,
            sampleEverySeconds:8,
            maxFrames:120,
            priority:10,
          }),
        })
        const sourceData=await source.json() as {ok?:boolean;error?:string;source?:{id:string}}
        if(!source.ok||!sourceData.ok)throw new Error(sourceData.error??'Unable to create recurring Director Watch source')
        setStatus('Recurring study source armed. Jhadina will revisit it when compute is idle; observations still require feedback/approval before becoming taste.')
      }else{
        const watch=await fetch('/api/director/watch-jobs',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({
            purpose:'creative',
            mediaId,
            sourceKind,
            rightsVerified:true,
            sourceAuthorized:true,
          }),
        })
        const watchData=await watch.json() as {ok?:boolean;error?:string;job?:{id:string;status:string};nextBoundary?:string}
        if(!watch.ok||!watchData.ok)throw new Error(watchData.error??'Unable to start Director Watch study')
        await load()
        setStatus(
          watchData.job?.status==='blocked'
            ? 'Media registered, but the Watch worker is not commissioned yet. The job is preserved and fail-closed.'
            : 'Director Watch study submitted. Observations will land as evidence and cinematic notes—not automatic taste.'
        )
      }
      setTitle('')
      setSourceUri('')
    }catch(error){
      setStatus(error instanceof Error?error.message:'Unable to start Director Watch study')
    }finally{
      setBusy(false)
    }
  }

  async function runCommissioning(){
    if(commissioningRun)return
    setCommissioningRun(true);setStatus(null)
    try{
      const response=await fetch('/api/director/watch-jobs/commissioning',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({purposes:['creative','sports','take-qc']}),
      })
      const data=await response.json() as {
        ok?:boolean
        error?:string
        submitted?:Array<{purpose:string;jobId:string}>
        unavailable?:Array<{purpose:string;reason:string}>
      }
      if(!response.ok||!data.ok)throw new Error(data.error??'Watch commissioning failed')
      const submitted=data.submitted?.length??0
      const unavailable=(data.unavailable??[]).map(item=>item.purpose+': '+item.reason)
      setStatus(
        'Commissioning dispatched '+submitted+' path'+(submitted===1?'':'s')+
        (unavailable.length?' · '+unavailable.join(' · '):'')+
        '. Status becomes commissioned only after authenticated callbacks persist evidence.'
      )
      await load()
    }catch(error){
      setStatus(error instanceof Error?error.message:'Watch commissioning failed')
    }finally{
      setCommissioningRun(false)
    }
  }

  return <section className="rounded-xl border bg-background p-4">
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Jhadina Watch</p>
      <h2 className="font-semibold">Study authorized film and video</h2>
      <p className="text-xs text-muted-foreground">Frame observations become cinematic notes and taste evidence. They do not become approved creative preferences until you explicitly reinforce/approve them.</p>
      {commissioning?<div className="mt-2 rounded-lg border p-3 text-[11px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <span className="rounded border px-2 py-1">{commissioning.configured?'Worker configured':'Worker not configured'}</span>
            <span className="rounded border px-2 py-1">{commissioning.runtime?.reachable?'Reachable':'Unreachable'}</span>
            <span className="rounded border px-2 py-1">{commissioning.runtime?.productionReady?'Production ready':'Production unproven'}</span>
            <span className="rounded border px-2 py-1">{commissioning.purposeStatus?.creative?.commissioned?'Creative commissioned':'Creative unproven'}</span>
            <span className="rounded border px-2 py-1">{commissioning.purposeStatus?.sports?.commissioned?'Sports commissioned':'Sports unproven'}</span>
            <span className="rounded border px-2 py-1">{commissioning.purposeStatus?.['take-qc']?.commissioned?'Take QC commissioned':'Take QC unproven'}</span>
          </div>
          <button
            className="rounded border px-2 py-1 disabled:opacity-40"
            disabled={commissioningRun||!commissioning.runtime?.productionReady}
            onClick={()=>void runCommissioning()}
          >{commissioningRun?'Commissioning…':'Run commissioning drill'}</button>
        </div>
        {commissioning.runtime?.error?<p className="mt-2 text-destructive">{commissioning.runtime.error}</p>:null}
      </div>:null}
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      <input className="rounded border bg-background p-2 text-sm" value={title} onChange={event=>setTitle(event.target.value)} placeholder="Title / reference name"/>
      <input className="rounded border bg-background p-2 text-sm" value={sourceUri} onChange={event=>setSourceUri(event.target.value)} placeholder={
        sourceKind==='homebase-capture'||sourceKind==='capture'
          ?'Configured Homebase capture alias, e.g. living-room-hdmi'
          :sourceKind==='local-file'
            ?'Approved Homebase DVR/media path'
            :sourceKind==='rtsp'
              ?'Allowlisted RTSP URL'
              :'Authorized HTTPS video/stream URL'
      }/>
      <select className="rounded border bg-background p-2 text-sm" value={mediaType} onChange={event=>setMediaType(event.target.value as MediaType)}>
        <option value="movie">Movie / film</option>
        <option value="youtube">YouTube / online video</option>
        <option value="music">Music video</option>
        <option value="jhadina_work">Jhadina-produced work</option>
      </select>
      <select className="rounded border bg-background p-2 text-sm" value={sourceKind} onChange={event=>setSourceKind(event.target.value as SourceKind)}>
        <option value="authorized-stream">Authorized HTTPS stream/file</option>
        <option value="hls">HLS</option>
        <option value="dash">DASH</option>
        <option value="homebase-capture">Homebase HDMI / tuner alias</option>
        <option value="rtsp">Homebase RTSP feed</option>
        <option value="local-file">Homebase DVR / local media path</option>
        <option value="capture">Homebase configured capture alias</option>
      </select>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={background||['homebase-capture','local-file','rtsp','capture'].includes(sourceKind)}
          disabled={busy||['homebase-capture','local-file','rtsp','capture'].includes(sourceKind)}
          onChange={event=>setBackground(event.target.checked)}
        />
        Study this again in Jhadina&apos;s spare time
      </label>
      {(background||['homebase-capture','local-file','rtsp','capture'].includes(sourceKind))?<label className="flex items-center gap-2 text-xs">Every
        <input className="w-20 rounded border bg-background p-1.5 text-sm" type="number" min={15} max={10080} value={cadenceMinutes} disabled={busy} onChange={event=>setCadenceMinutes(Math.max(15,Number(event.target.value)||180))}/>
        minutes
      </label>:null}
      <button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy||!title.trim()||!sourceUri.trim()} onClick={()=>void study()}>
        {busy?'Submitting…':(background||['homebase-capture','local-file','rtsp','capture'].includes(sourceKind))?'Arm background study':'Watch & take notes'}
      </button>
      <span className="text-[11px] text-muted-foreground">Only use sources you are authorized to analyze.</span>
    </div>

    {jobs.length?<div className="mt-4 grid gap-2">
      {jobs.slice(0,8).map(job=><div key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs">
        <span>{job.id}</span>
        <span>{job.status} · {job.result_count} observation{job.result_count===1?'':'s'}{job.error?' · '+job.error:''}</span>
      </div>)}
    </div>:null}
    {status?<p className="mt-3 text-xs text-muted-foreground" role="status">{status}</p>:null}
  </section>
}
