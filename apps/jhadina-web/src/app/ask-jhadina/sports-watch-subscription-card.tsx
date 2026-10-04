"use client"

import {useCallback,useEffect,useState} from "react"

type SourceKind="authorized-stream"|"hls"|"dash"|"homebase-capture"|"rtsp"|"local-file"|"capture"
type EventResolution={
 eventId:string
 providerEventId:string
 eventLabel:string
 sport:string
 league?:string|null
 scheduledAt?:string|null
 status:string
 homeTeam?:{id:string;name:string}|null
 awayTeam?:{id:string;name:string}|null
 evidenceIds:string[]
}
type SourceRow={
 id:string
 label:string
 purpose:"sports"
 event_id:string
 subject_id:string
 source_kind:SourceKind
 execution_target:"cloud"|"homebase"
 enabled:boolean
 cadence_minutes:number
 next_due_at:string
 last_completed_at?:string|null
 last_error?:string|null
 metadata?:Record<string,unknown>
}

function homebaseKind(kind:SourceKind){
 return ["homebase-capture","rtsp","local-file","capture"].includes(kind)
}

export function SportsWatchSubscriptionCard({defaultQuery=""}:{defaultQuery?:string}){
 const [query,setQuery]=useState(defaultQuery)
 const [liveOnly,setLiveOnly]=useState(false)
 const [event,setEvent]=useState<EventResolution|null>(null)
 const [sourceKind,setSourceKind]=useState<SourceKind>("homebase-capture")
 const [sourceLocator,setSourceLocator]=useState("")
 const [cadence,setCadence]=useState(15)
 const [authorized,setAuthorized]=useState(false)
 const [sources,setSources]=useState<SourceRow[]>([])
 const [busy,setBusy]=useState(false)
 const [status,setStatus]=useState("")

 const load=useCallback(async()=>{
  const response=await fetch("/api/director/watch-sources",{cache:"no-store"})
  const data=await response.json() as {ok?:boolean;sources?:SourceRow[];error?:string}
  if(!response.ok||!data.ok)throw new Error(data.error??"Unable to load sports Watch subscriptions")
  setSources((data.sources??[]).filter(row=>row.purpose==="sports"))
 },[])

 useEffect(()=>{void load().catch(error=>setStatus(error instanceof Error?error.message:"Unable to load sports Watch subscriptions"))},[load])

 async function resolveGame(){
  if(!query.trim()||busy)return
  setBusy(true);setStatus("")
  try{
   const response=await fetch("/api/director/watch-sources/resolve-sports",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({query:query.trim(),liveRequested:liveOnly}),
   })
   const data=await response.json() as {ok?:boolean;event?:EventResolution;error?:string}
   if(!response.ok||!data.ok||!data.event)throw new Error(data.error??"Unable to resolve sports event")
   setEvent(data.event)
   setStatus("Event resolved. Choose the authorized feed Jhadina may observe.")
  }catch(error){
   setEvent(null)
   setStatus(error instanceof Error?error.message:"Unable to resolve sports event")
  }finally{setBusy(false)}
 }

 async function arm(){
  if(!event||!sourceLocator.trim()||!authorized||busy)return
  setBusy(true);setStatus("")
  try{
   const homebase=homebaseKind(sourceKind)
   const response=await fetch("/api/director/watch-sources",{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
     purpose:"sports",
     label:"Game Watch · "+event.eventLabel,
     eventId:event.eventId,
     subjectId:"event:"+event.eventId+":game-context",
     sourceKind,
     sourceLocator:sourceLocator.trim(),
     executionTarget:homebase?"homebase":"cloud",
     rightsVerified:true,
     sourceAuthorized:true,
     cadenceMinutes:cadence,
     sampleEverySeconds:2,
     maxFrames:180,
     priority:25,
     metadata:{
      providerEventId:event.providerEventId,
      eventLabel:event.eventLabel,
      sport:event.sport,
      league:event.league??null,
      scheduledAt:event.scheduledAt??null,
      eventEvidenceIds:event.evidenceIds,
      authority:"DIRECTOR_INFERENCE_ONLY",
      canonicalRealityEligible:false,
      bettingAuthority:"NONE",
      financialAuthority:"NONE",
     },
    }),
   })
   const data=await response.json() as {ok?:boolean;error?:string;source?:{id:string}}
   if(!response.ok||!data.ok)throw new Error(data.error??"Unable to arm game Watch source")
   await load()
   setStatus("Game Watch armed. Jhadina may study this authorized feed during idle capacity; observations remain intelligence-only and cannot place bets.")
   setAuthorized(false)
  }catch(error){
   setStatus(error instanceof Error?error.message:"Unable to arm game Watch source")
  }finally{setBusy(false)}
 }

 async function toggle(source:SourceRow){
  if(busy)return
  setBusy(true);setStatus("")
  try{
   const response=await fetch("/api/director/watch-sources",{
    method:"PATCH",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({id:source.id,enabled:!source.enabled}),
   })
   const data=await response.json() as {ok?:boolean;error?:string}
   if(!response.ok||!data.ok)throw new Error(data.error??"Unable to update game Watch source")
   await load()
   setStatus(source.enabled?"Game Watch paused.":"Game Watch resumed.")
  }catch(error){
   setStatus(error instanceof Error?error.message:"Unable to update game Watch source")
  }finally{setBusy(false)}
 }

 return <div className="jh-section" style={{marginTop:20}}>
  <div className="jh-item">
   <div className="jh-between" style={{gap:16,alignItems:"flex-start"}}>
    <div>
     <p className="jh-eyebrow">Sports Watch · spare-time perception</p>
     <h2 className="jh-card-title">Let Jhadina study games without uploads</h2>
     <p className="jh-card-copy">Resolve a real event once, bind an authorized stream/tuner/DVR feed, and the low-priority Watch scheduler can revisit it when compute is idle. Video inference never establishes official score/clock/possession by itself and has no wager authority.</p>
    </div>
    <span className="jh-status"><span className="jh-dot"/>INTELLIGENCE ONLY</span>
   </div>

   <div className="jh-row" style={{marginTop:12}}>
    <input className="jh-input" style={{minWidth:280}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Team / matchup / event, e.g. Lakers vs Warriors"/>
    <label className="jh-meta" style={{display:"flex",alignItems:"center",gap:6}}>
     <input type="checkbox" checked={liveOnly} onChange={e=>setLiveOnly(e.target.checked)}/>
     live/current event only
    </label>
    <button type="button" className="jh-button" disabled={busy||!query.trim()} onClick={()=>void resolveGame()}>{busy?"Working…":"Resolve game"}</button>
   </div>

   {event?<div className="jh-item" style={{marginTop:12}}>
    <strong>{event.eventLabel}</strong>
    <p className="jh-meta">{event.sport}{event.league?" · "+event.league:""}{event.scheduledAt?" · "+new Date(event.scheduledAt).toLocaleString():""} · {event.status}</p>
    <div className="jh-row" style={{marginTop:10}}>
     <select className="jh-input" value={sourceKind} onChange={e=>setSourceKind(e.target.value as SourceKind)}>
      <option value="homebase-capture">Homebase HDMI / tuner alias</option>
      <option value="rtsp">Homebase RTSP feed</option>
      <option value="local-file">Homebase DVR / recorded game</option>
      <option value="capture">Homebase configured capture alias</option>
      <option value="authorized-stream">Authorized HTTPS stream/file</option>
      <option value="hls">Authorized HLS</option>
      <option value="dash">Authorized DASH</option>
     </select>
     <input className="jh-input" style={{minWidth:280}} value={sourceLocator} onChange={e=>setSourceLocator(e.target.value)} placeholder={
      sourceKind==="homebase-capture"||sourceKind==="capture"?"Capture alias, e.g. tv-tuner":
      sourceKind==="local-file"?"Approved Homebase DVR path":
      sourceKind==="rtsp"?"Allowlisted RTSP URL":
      "Authorized HTTPS/HLS/DASH URL"
     }/>
     <label className="jh-meta">every <input className="jh-input" style={{width:76}} type="number" min={15} max={10080} value={cadence} onChange={e=>setCadence(Math.max(15,Math.min(10080,Number(e.target.value)||15)))}/> min</label>
    </div>
    <label className="jh-meta" style={{display:"flex",alignItems:"center",gap:6,marginTop:10}}>
     <input type="checkbox" checked={authorized} onChange={e=>setAuthorized(e.target.checked)}/>
     I am authorized to let Jhadina analyze this source.
    </label>
    <button type="button" className="jh-button" style={{marginTop:10}} disabled={busy||!authorized||!sourceLocator.trim()} onClick={()=>void arm()}>
     Arm spare-time game study
    </button>
   </div>:null}

   {sources.length?<div style={{marginTop:16}}>
    <strong>Recurring game Watch sources</strong>
    <div className="jh-list" style={{marginTop:8}}>
     {sources.slice(0,8).map(source=><div className="jh-item" key={source.id}>
      <div className="jh-between" style={{gap:12}}>
       <div>
        <strong>{source.label}</strong>
        <p className="jh-meta">{source.execution_target} · {source.source_kind} · every {source.cadence_minutes} min · {source.enabled?"enabled":"paused"}</p>
        {source.last_completed_at?<p className="jh-meta">Last completed: {new Date(source.last_completed_at).toLocaleString()}</p>:null}
        {source.last_error?<p className="jh-meta" style={{color:"var(--jh-danger)"}}>{source.last_error}</p>:null}
       </div>
       <button type="button" className="jh-button" disabled={busy} onClick={()=>void toggle(source)}>{source.enabled?"Pause":"Resume"}</button>
      </div>
     </div>)}
    </div>
   </div>:null}

   {status?<p className="jh-meta" style={{marginTop:12}} role="status">{status}</p>:null}
   <p className="jh-meta" style={{marginTop:12}}>Prediction authority: context only · betting authority: NONE · financial authority: NONE · execution: disabled</p>
  </div>
 </div>
}
