'use client'

import {useCallback,useEffect,useMemo,useState} from 'react'

type MediaType='youtube'|'movie'|'music'|'jhadina_work'
type SourceKind='authorized-stream'|'hls'|'dash'|'local-file'
type Observation={
  id:string
  media_id:string
  domain:string
  technique:string
  interpretation:string
  confidence:number
  start_ms?:number|null
}
type Feedback={target_id:string;signal:'positive'|'negative';created_at:string}
type Hypothesis={
  id:string
  domain:string
  pattern:string
  positiveCount:number
  negativeCount:number
  confidence:number
  status:'candidate'|'approved'|'rejected'
}
type Preference={id:string;domain:string;preference:string;confidence:number;approved_at:string}
type WatchJob={id:string;status:string;result_count:number;error?:string|null;updated_at:string}

export function WorkstationMediaStudy(){
  const [title,setTitle]=useState('')
  const [sourceUri,setSourceUri]=useState('')
  const [mediaType,setMediaType]=useState<MediaType>('movie')
  const [sourceKind,setSourceKind]=useState<SourceKind>('authorized-stream')
  const [authorized,setAuthorized]=useState(false)
  const [observations,setObservations]=useState<Observation[]>([])
  const [feedback,setFeedback]=useState<Feedback[]>([])
  const [hypotheses,setHypotheses]=useState<Hypothesis[]>([])
  const [preferences,setPreferences]=useState<Preference[]>([])
  const [jobs,setJobs]=useState<WatchJob[]>([])
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const [studyResponse,jobResponse]=await Promise.all([
      fetch('/api/director/media-study',{cache:'no-store'}),
      fetch('/api/director/watch-jobs?purpose=creative',{cache:'no-store'}),
    ])
    const study=await studyResponse.json() as {
      ok?:boolean;error?:string;observations?:Observation[];feedback?:Feedback[];
      hypotheses?:Hypothesis[];approvedPreferences?:Preference[];
    }
    const watch=await jobResponse.json() as {ok?:boolean;error?:string;jobs?:WatchJob[]}
    if(!studyResponse.ok||!study.ok)throw new Error(study.error??'Unable to load media study')
    if(!jobResponse.ok||!watch.ok)throw new Error(watch.error??'Unable to load Watch jobs')
    setObservations(study.observations??[])
    setFeedback(study.feedback??[])
    setHypotheses(study.hypotheses??[])
    setPreferences(study.approvedPreferences??[])
    setJobs(watch.jobs??[])
  },[])

  useEffect(()=>{void load().catch(error=>setStatus(error instanceof Error?error.message:'Unable to load Watch study'))},[load])

  const feedbackByTarget=useMemo(()=>{
    const map=new Map<string,Feedback>()
    for(const item of feedback)if(!map.has(item.target_id))map.set(item.target_id,item)
    return map
  },[feedback])

  async function startWatch(){
    if(busy||!authorized||!title.trim()||!sourceUri.trim())return
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
            provenance:{source:'workstation-watch',authorized:true},
          },
        }),
      })
      const registerData=await register.json() as {ok?:boolean;error?:string}
      if(!register.ok||!registerData.ok)throw new Error(registerData.error??'Unable to register media')

      const dispatch=await fetch('/api/director/watch-jobs',{
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
      const dispatchData=await dispatch.json() as {ok?:boolean;error?:string;job?:{status?:string}}
      if(!dispatch.ok||!dispatchData.ok)throw new Error(dispatchData.error??'Unable to start Watch job')
      setStatus(dispatchData.job?.status==='blocked'
        ? 'Media registered, but the RunPod Watch worker is not configured yet.'
        : 'Watch job submitted. Observations will appear here when the worker returns.')
      setTitle('');setSourceUri('');setAuthorized(false)
      await load()
    }catch(error){
      setStatus(error instanceof Error?error.message:'Unable to start Watch job')
    }finally{setBusy(false)}
  }

  async function react(observationId:string,signal:'positive'|'negative'){
    if(busy)return
    setBusy(true);setStatus(null)
    try{
      const response=await fetch('/api/director/media-study',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          action:'feedback',
          targetId:observationId,
          signal,
          scope:'technique',
        }),
      })
      const data=await response.json() as {ok?:boolean;error?:string}
      if(!response.ok||!data.ok)throw new Error(data.error??'Unable to save taste feedback')
      await load()
    }catch(error){
      setStatus(error instanceof Error?error.message:'Unable to save taste feedback')
    }finally{setBusy(false)}
  }

  async function approveTaste(hypothesisId:string){
    if(busy)return
    setBusy(true);setStatus(null)
    try{
      const response=await fetch('/api/director/media-study',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'approve_taste',hypothesisId}),
      })
      const data=await response.json() as {ok?:boolean;error?:string}
      if(!response.ok||!data.ok)throw new Error(data.error??'Unable to approve taste preference')
      setStatus('Taste preference approved for future Director creative context.')
      await load()
    }catch(error){
      setStatus(error instanceof Error?error.message:'Unable to approve taste preference')
    }finally{setBusy(false)}
  }

  return <section className="rounded-xl border bg-background p-4">
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Watch + taste</p>
      <h2 className="font-semibold">Let Jhadina study authorized media</h2>
      <p className="text-xs text-muted-foreground">Watch observations are evidence only. Your feedback creates taste hypotheses; only approved preferences steer future Director planning.</p>
    </div>

    <div className="mt-3 grid gap-2 lg:grid-cols-4">
      <input className="rounded border bg-background p-2 text-sm" placeholder="Title" value={title} disabled={busy} onChange={event=>setTitle(event.target.value)}/>
      <input className="rounded border bg-background p-2 text-sm lg:col-span-2" placeholder="Authorized media URL / stream locator" value={sourceUri} disabled={busy} onChange={event=>setSourceUri(event.target.value)}/>
      <select className="rounded border bg-background p-2 text-sm" value={mediaType} disabled={busy} onChange={event=>setMediaType(event.target.value as MediaType)}>
        <option value="movie">Movie / film</option>
        <option value="youtube">YouTube / video</option>
        <option value="music">Music video</option>
        <option value="jhadina_work">Jhadina work</option>
      </select>
      <select className="rounded border bg-background p-2 text-sm" value={sourceKind} disabled={busy} onChange={event=>setSourceKind(event.target.value as SourceKind)}>
        <option value="authorized-stream">Authorized stream</option>
        <option value="hls">HLS</option>
        <option value="dash">DASH</option>
        <option value="local-file">Local/private file locator</option>
      </select>
      <label className="flex items-center gap-2 rounded border px-3 py-2 text-xs lg:col-span-2">
        <input type="checkbox" checked={authorized} disabled={busy} onChange={event=>setAuthorized(event.target.checked)}/>
        I confirm this source is authorized for Jhadina to analyze.
      </label>
      <button className="rounded border px-3 py-2 text-sm disabled:opacity-40" disabled={busy||!authorized||!title.trim()||!sourceUri.trim()} onClick={()=>void startWatch()}>
        {busy?'Working…':'Watch & take notes'}
      </button>
    </div>

    {jobs.length?<div className="mt-3 flex flex-wrap gap-2 text-xs">
      {jobs.slice(0,5).map(job=><span key={job.id} className="rounded border px-2 py-1">Watch {job.status} · {job.result_count} observations{job.error?' · '+job.error:''}</span>)}
    </div>:null}

    {observations.length?<div className="mt-4">
      <p className="text-xs font-medium">Recent observations</p>
      <div className="mt-2 grid gap-2 lg:grid-cols-2">
        {observations.slice(0,12).map(item=>{
          const existing=feedbackByTarget.get(item.id)
          return <article key={item.id} className="rounded border p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{item.domain} · {item.technique}</span>
              <span>{Math.round(Number(item.confidence)*100)}%</span>
            </div>
            <p className="mt-1 text-muted-foreground">{item.interpretation}</p>
            <div className="mt-2 flex gap-2">
              <button className="rounded border px-2 py-1 disabled:opacity-40" disabled={busy||existing?.signal==='positive'} onClick={()=>void react(item.id,'positive')}>👍 useful</button>
              <button className="rounded border px-2 py-1 disabled:opacity-40" disabled={busy||existing?.signal==='negative'} onClick={()=>void react(item.id,'negative')}>👎 not my taste</button>
            </div>
          </article>
        })}
      </div>
    </div>:null}

    {hypotheses.length?<div className="mt-4">
      <p className="text-xs font-medium">Taste hypotheses</p>
      <div className="mt-2 grid gap-2 lg:grid-cols-2">
        {hypotheses.slice(0,10).map(item=><article key={item.id} className="rounded border p-3 text-xs">
          <p className="font-medium">{item.domain} · {item.pattern}</p>
          <p className="mt-1 text-muted-foreground">{item.positiveCount} positive · {item.negativeCount} negative · {Math.round(item.confidence*100)}% confidence</p>
          {item.status==='candidate'?<button className="mt-2 rounded border px-2 py-1 disabled:opacity-40" disabled={busy} onClick={()=>void approveTaste(item.id)}>Approve taste</button>:null}
        </article>)}
      </div>
    </div>:null}

    {preferences.length?<div className="mt-4">
      <p className="text-xs font-medium">Approved creative preferences</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {preferences.slice(0,12).map(item=><span key={item.id} className="rounded border px-2 py-1">{item.domain}: {item.preference}</span>)}
      </div>
    </div>:null}

    {status?<p className="mt-3 text-xs text-muted-foreground" role="status">{status}</p>:null}
  </section>
}
