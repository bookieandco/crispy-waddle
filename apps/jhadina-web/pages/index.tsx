import React,{useEffect,useMemo,useState} from "react"
import Link from "next/link"
import { getCurrentUserId } from "@/lib/auth/current-user"
import { PersonalCommandFeed } from "../components/home/PersonalCommandFeed"
import { HomeCommandBar } from "../src/components/home/HomeCommandBar"
import { HomeWorldStrip } from "../src/components/home/HomeWorldStrip"
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
  }catch(cause){setError(cause instanceof Error?cause.message:"Home intelligence unavailable")}
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

 return <main className="jh-page jh-home"><div className="jh-wrap">
  <section className="jh-home-hero">
   <p className="jh-eyebrow">Jhadina Home</p>
   <h1 className="jh-title">Everything comes to you.</h1>
   <p className="jh-copy">Your social media, shows, YouTube, opportunities, money, sports, creative work and other Jhadina systems share one home feed. Open any world directly when you want to go deeper.</p>
   <HomeCommandBar/>
  </section>

  <section className="jh-section jh-section--tight">
   <div className="jh-between"><div><p className="jh-eyebrow">Open directly</p><h2 className="jh-section-title">Your worlds</h2></div><Link className="jh-button" href="/worlds">All worlds</Link></div>
   <HomeWorldStrip/>
  </section>

  <section className="jh-section jh-section--tight">
   <div className="jh-between"><div><p className="jh-eyebrow">Your feed</p><h2 className="jh-section-title">What is happening across Jhadina</h2><p className="jh-card-copy">Social/media activity keeps source and provenance. Governed system activity stays linked to its real workstation rather than becoming a fake dashboard action.</p></div><Link className="jh-button" href="/activity">Activity</Link></div>
   <div aria-label="Filter your stream" className="jh-feed-filters">
    {(["All","Social","TikTok","Facebook","Snapchat","Instagram","YouTube","Reddit","X","LinkedIn","Threads","Bluesky","Tumblr","VK","Director"] as FeedSource[]).map(source=><button key={source} type="button" aria-pressed={streamSource===source} onClick={()=>setStreamSource(source)} className={streamSource===source?"jh-button jh-button--primary":"jh-button"}>{source}</button>)}
   </div>
   <PersonalCommandFeed source={streamSource}/>
  </section>

  <section className="jh-section">
   <div className="jh-between"><div><p className="jh-eyebrow">Attention</p><h2 className="jh-section-title">Only interrupt you when it matters</h2></div><Link className="jh-button" href="/work">Open Work</Link></div>
   {error&&<div className="jh-error" role="alert">{error}</div>}
   <div className="jh-grid">
    <Link className="jh-card jh-card--third" href="/approvals"><div className="jh-metric">{loading?"—":model.needs}</div><div className="jh-label">Needs you</div><p className="jh-card-copy">Approvals and decisions that require your input.</p></Link>
    <Link className="jh-card jh-card--third" href="/work"><div className="jh-metric">{loading?"—":model.active}</div><div className="jh-label">Active work</div><p className="jh-card-copy">Current governed work plus route-backed workstations.</p></Link>
    <Link className="jh-card jh-card--third" href="/activity"><div className="jh-metric">{loading?"—":model.exceptions}</div><div className="jh-label">Exceptions</div><p className="jh-card-copy">{loading?"Loading evidence…":model.recoveryRequired+" recovery-required · "+model.retrySafe+" retry-safe."}</p></Link>
   </div>
  </section>

  <section className="jh-section"><div className="jh-between"><div><p className="jh-eyebrow">Black box</p><h2 className="jh-section-title">Recent governed evidence</h2></div><Link className="jh-button" href="/activity">See all</Link></div>
   {loading?<div className="jh-list"><div className="jh-skeleton"/><div className="jh-skeleton"/></div>:model.recent.length===0?<div className="jh-empty">No governed activity has been recorded for this identity yet.</div>:<div className="jh-list">{model.recent.map(event=><article className="jh-item" key={event.id}><div className="jh-between"><div><strong>{event.type}</strong><p className="jh-meta">{event.domain} · {new Date(event.timestamp).toLocaleString()}</p></div><span className={event.status==="completed"?"jh-status jh-status--success":event.status==="failed"||event.status==="denied"?"jh-status jh-status--danger":"jh-status jh-status--warning"}>{event.status.replaceAll("_"," ")}</span></div></article>)}</div>}
  </section>
 </div></main>
}
