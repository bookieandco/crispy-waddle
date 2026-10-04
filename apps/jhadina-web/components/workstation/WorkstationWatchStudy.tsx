'use client'

import {useCallback,useEffect,useState} from 'react'

type MediaType='youtube'|'movie'|'music'|'jhadina_work'
type SourceKind='authorized-stream'|'hls'|'dash'
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
  const [jobs,setJobs]=useState<WatchJob[]>([])
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const response=await fetch('/api/director/watch-jobs?purpose=creative',{cache:'no-store'})
    const data=await response.json() as {ok?:boolean;jobs?:WatchJob[];error?:string}
    if(!response.ok||!data.ok)throw new Error(data.error??'Unable to load Director Watch jobs')
    setJobs(data.jobs??[])
  },[])

  useEffect(()=>{void load().catch(error=>setStatus(error instanceof Error?error.message:'Unable to load Director Watch jobs'))},[load])

  async function study(){
    if(!title.trim()||!sourceUri.trim()||busy)return
    setBusy(true);setStatus(null)
    try{
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
      setTitle('')
      setSourceUri('')
    }catch(error){
      setStatus(error instanceof Error?error.message:'Unable to start Director Watch study')
    }finally{
      setBusy(false)
    }
  }

  return <section className="rounded-xl border bg-background p-4">
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Jhadina Watch</p>
      <h2 className="font-semibold">Study authorized film and video</h2>
      <p className="text-xs text-muted-foreground">Frame observations become cinematic notes and taste evidence. They do not become approved creative preferences until you explicitly reinforce/approve them.</p>
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      <input className="rounded border bg-background p-2 text-sm" value={title} onChange={event=>setTitle(event.target.value)} placeholder="Title / reference name"/>
      <input className="rounded border bg-background p-2 text-sm" value={sourceUri} onChange={event=>setSourceUri(event.target.value)} placeholder="Authorized HTTPS video/stream URL"/>
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
      </select>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy||!title.trim()||!sourceUri.trim()} onClick={()=>void study()}>
        {busy?'Submitting…':'Watch & take notes'}
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
