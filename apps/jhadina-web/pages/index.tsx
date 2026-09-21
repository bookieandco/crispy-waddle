import React,{useEffect,useMemo,useState} from "react"
import Link from "next/link"
import { getCurrentUserId } from "@/lib/auth/current-user"
import { PersonalCommandFeed } from "../components/home/PersonalCommandFeed"
import type { FeedSource } from "../components/home/storyTypes"
import { connectorExecutionState } from "@/lib/system/execution-ux"

type Event={id:string;actionId:string;type:string;status:"started"|"approval_required"|"completed"|"denied"|"failed";timestamp:string;domain:string}
type Candidate={id:string}
type Recovery={id:string;state:string;operation:string|null;startedAt:string;reconciliation?:{status:string;checkedAt:string}|null}

export default function Home(){
 const [events,setEvents]=useState<Event[]>([])
 const [candidates,setCandidates]=useState<Candidate[]>([])
 const [recoveries,setRecoveries]=useState<Recovery[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 const [streamSource,setStreamSource]=useState<FeedSource>("All")

 useEffect(()=>{void(async()=>{
  setLoading(true);setError("")
  try{
   const userId=await getCurrentUserId();if(!userId)throw new Error("Not signed in")
   const [activityResponse,candidateResponse,recoveryResponse]=await Promise.all([
    fetch("/api/system/activity",{cache:"no-store",headers:{"x-jhadina-user-id":userId}}),
    fetch("/api/candidates",{cache:"no-store",headers:{"x-user-id":userId}}),
    fetch("/api/system/recovery",{cache:"no-store",headers:{"x-jhadina-user-id":userId}}),
   ])
   const activityJson=await activityResponse.json();const candidateJson=await candidateResponse.json()
   if(!activityResponse.ok)throw new Error(activityJson.error||"Activity unavailable")
   if(!candidateResponse.ok)throw new Error(candidateJson.error||"Approvals unavailable")
   setEvents(activityJson.events??[]);setCandidates(candidateJson.data?.candidates??[])
   if(recoveryResponse.ok){const recoveryJson=await recoveryResponse.json();setRecoveries(recoveryJson.executions??[])}
  }catch(cause){setError(cause instanceof Error?cause.message:"Mission Control unavailable")}
  finally{setLoading(false)}
 })()},[])

 const model=useMemo(()=>{
  const latestByAction=new Map<string,Event>()
  for(const event of [...events].sort((a,b)=>a.timestamp.localeCompare(b.timestamp)))latestByAction.set(event.actionId,event)
  const latest=[...latestByAction.values()]
  const approvalEvents=latest.filter(event=>event.status==="approval_required").length
  const active=latest.filter(event=>event.status==="started").length
  const exceptions=latest.filter(event=>event.status==="failed"||event.status==="denied").length
  const recoveryStates=recoveries.map(item=>connectorExecutionState({state:item.state,recoveryOfExecutionId:undefined,reconciliation:item.reconciliation?{status:item.reconciliation.status}:null}))
  const recoveryRequired=recoveryStates.filter(item=>item==="recovery_required").length
  const retrySafe=recoveryStates.filter(item=>item==="retry_safe").length
  return {needs:candidates.length+approvalEvents+retrySafe,active,exceptions:exceptions+recoveryRequired,recoveryRequired,retrySafe,recent:[...events].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,6)}
 },[events,candidates,recoveries])

 return <main className="jh-page"><div className="jh-wrap">
  <p className="jh-eyebrow">Mission Control</p>
  <div className="jh-between"><div><h1 className="jh-title">What needs your attention.</h1><p className="jh-copy">Continue work, review decisions, inspect exceptions, or ask Jhadina. Counts are derived from governed evidence; unavailable data stays unavailable instead of becoming a fake zero.</p></div><Link className="jh-button jh-button--primary" href="/ask-jhadina">Ask Jhadina</Link></div>
  {error&&<div className="jh-error" role="alert">{error}</div>}
  <div className="jh-grid">
   <Link className="jh-card jh-card--third" href="/approvals"><div className="jh-metric">{loading?"—":model.needs}</div><div className="jh-label">Needs you</div><p className="jh-card-copy">Memory proposals and governed approval-required work.</p></Link>
   <Link className="jh-card jh-card--third" href="/work"><div className="jh-metric">{loading?"—":model.active}</div><div className="jh-label">Active work</div><p className="jh-card-copy">Current governed actions plus route-backed workspaces.</p></Link>
   <Link className="jh-card jh-card--third" href="/activity"><div className="jh-metric">{loading?"—":model.exceptions}</div><div className="jh-label">Exceptions</div><p className="jh-card-copy">{loading?"Loading evidence…":model.recoveryRequired+" recovery-required · "+model.retrySafe+" retry-safe awaiting fresh authorization."}</p></Link>
  </div>

  <section className="jh-section"><div className="jh-between"><div><p className="jh-eyebrow">Continue</p><h2 className="jh-section-title">Your operating surfaces</h2></div><Link className="jh-button" href="/worlds">All worlds</Link></div>
   <div className="jh-grid">
    <Link className="jh-card jh-card--third" href="/money/command-center"><h3 className="jh-card-title">Money</h3><p className="jh-card-copy">Accounts, financial awareness and governed decisions.</p></Link>
    <Link className="jh-card jh-card--third" href="/opportunity"><h3 className="jh-card-title">Opportunities</h3><p className="jh-card-copy">Side income, SAM, POD and other qualified opportunities.</p></Link>
    <Link className="jh-card jh-card--third" href="/workstation"><h3 className="jh-card-title">Director Workstation</h3><p className="jh-card-copy">Creative projects, generated assets and timeline editing.</p></Link>
    <Link className="jh-card jh-card--third" href="/spatial"><h3 className="jh-card-title">Spatial</h3><p className="jh-card-copy">Evidence-backed live-world context and replay.</p></Link>
    <Link className="jh-card jh-card--third" href="/music"><h3 className="jh-card-title">Music</h3><p className="jh-card-copy">Listening, discovery and the music intelligence layer.</p></Link>
    <Link className="jh-card jh-card--third" href="/jhadinatv"><h3 className="jh-card-title">JhadinaTV</h3><p className="jh-card-copy">Media discovery, playback and entertainment intelligence.</p></Link>
   </div>
  </section>

  <section className="jh-section">
   <div className="jh-between"><div><p className="jh-eyebrow">Your stream</p><h2 className="jh-section-title">Social, media & Jhadina intelligence</h2><p className="jh-card-copy">A source-preserving scroll across connected social activity, media, Growth proposals and Jhadina context. This is discovery/awareness—not a second navigation system.</p></div><Link className="jh-button" href="/social">Open Social</Link></div>
   <div aria-label="Filter your stream" style={{display:"flex",gap:8,overflowX:"auto",padding:"12px 0 18px",scrollbarWidth:"none"}}>
    {(["All","Social","TikTok","Facebook","Snapchat","Instagram","YouTube","Reddit","X","LinkedIn","Threads","Bluesky","Tumblr","VK","Director"] as FeedSource[]).map(source=><button key={source} type="button" aria-pressed={streamSource===source} onClick={()=>setStreamSource(source)} className={streamSource===source?"jh-button jh-button--primary":"jh-button"} style={{flex:"0 0 auto"}}>{source}</button>)}
   </div>
   <PersonalCommandFeed source={streamSource}/>
  </section>


  <section className="jh-section"><div className="jh-between"><div><p className="jh-eyebrow">Recent evidence</p><h2 className="jh-section-title">Black-box trail</h2></div><Link className="jh-button" href="/activity">Open Activity</Link></div>
   {loading?<div className="jh-list"><div className="jh-skeleton"/><div className="jh-skeleton"/></div>:model.recent.length===0?<div className="jh-empty">No governed activity has been recorded for this identity yet.</div>:<div className="jh-list">{model.recent.map(event=><article className="jh-item" key={event.id}><div className="jh-between"><div><strong>{event.type}</strong><p className="jh-meta">{event.domain} · {new Date(event.timestamp).toLocaleString()}</p></div><span className={event.status==="completed"?"jh-status jh-status--success":event.status==="failed"||event.status==="denied"?"jh-status jh-status--danger":"jh-status jh-status--warning"}>{event.status.replaceAll("_"," ")}</span></div></article>)}</div>}
  </section>
 </div></main>
}
