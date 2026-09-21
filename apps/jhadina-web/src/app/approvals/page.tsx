"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { getCurrentUserId } from "@/lib/auth/current-user"

type MemoryCandidate={id:string;content:string;type:string;confidence:number;status:string;createdAt?:string}
type GrowthDraft={id:string;brand:string;kind:string;title?:string;body:string;rationale:string;status:string;platforms:string[]}
type ActivityEvent={id:string;actionId:string;type:string;status:"started"|"approval_required"|"completed"|"denied"|"failed";timestamp:string;domain:string;metadata?:Record<string,unknown>}
type GovernedApproval={actionId:string;type:string;domain:string;timestamp:string;state:"needs_review"|"resolved";terminal?:ActivityEvent["status"]}

const domainHref:Record<string,string>={
 intelligence:"/ask-jhadina",growth:"/growth",commerce:"/worlds",money:"/money/command-center"
}

export default function ApprovalsPage(){
 const [memory,setMemory]=useState<MemoryCandidate[]>([])
 const [growth,setGrowth]=useState<GrowthDraft[]>([])
 const [events,setEvents]=useState<ActivityEvent[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 const [busy,setBusy]=useState<string|null>(null)

 async function load(){
  setLoading(true);setError("")
  try{
   const userId=await getCurrentUserId()
   if(!userId)throw new Error("Not signed in")
   const [candidateRes,growthRes,activityRes]=await Promise.all([
    fetch("/api/candidates",{cache:"no-store",headers:{"x-user-id":userId}}),
    fetch("/api/growth/drafts",{cache:"no-store"}),
    fetch("/api/system/activity",{cache:"no-store",headers:{"x-jhadina-user-id":userId}}),
   ])
   const [candidateJson,growthJson,activityJson]=await Promise.all([candidateRes.json(),growthRes.json(),activityRes.json()])
   if(!candidateRes.ok)throw new Error(candidateJson.error||"Unable to load memory approvals")
   if(!growthRes.ok)throw new Error(growthJson.error||"Unable to load Growth approvals")
   if(!activityRes.ok)throw new Error(activityJson.error||"Unable to load governed approvals")
   setMemory(candidateJson.data?.candidates??[])
   setGrowth((growthJson.data?.drafts??[]).filter((draft:GrowthDraft)=>draft.status==="PENDING_APPROVAL"))
   setEvents(activityJson.events??[])
  }catch(cause){setError(cause instanceof Error?cause.message:"Unable to load approvals")}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[])

 const governed=useMemo<GovernedApproval[]>(()=>{
  const requests=new Map<string,ActivityEvent>()
  for(const event of events){if(event.status==="approval_required"){const previous=requests.get(event.actionId);if(!previous||previous.timestamp<event.timestamp)requests.set(event.actionId,event)}}
  return [...requests.values()].map(request=>{
   const later=events.filter(event=>event.actionId===request.actionId&&event.timestamp>request.timestamp&&["completed","denied","failed"].includes(event.status)).sort((a,b)=>b.timestamp.localeCompare(a.timestamp))[0]
   return {actionId:request.actionId,type:request.type,domain:request.domain,timestamp:request.timestamp,state:later?"resolved":"needs_review",terminal:later?.status}
  }).filter(item=>item.state==="needs_review").sort((a,b)=>b.timestamp.localeCompare(a.timestamp))
 },[events])

 async function memoryDecision(id:string,decision:"approve"|"reject"){
  setBusy("memory:"+id);setError("")
  try{
   const userId=await getCurrentUserId();if(!userId)throw new Error("Not signed in")
   const response=await fetch("/api/memory/"+decision,{method:"POST",headers:{"content-type":"application/json","x-user-id":userId},body:JSON.stringify({candidateId:id})})
   const json=await response.json();if(!response.ok)throw new Error(json.error||"Memory decision failed");await load()
  }catch(cause){setError(cause instanceof Error?cause.message:"Memory decision failed")}
  finally{setBusy(null)}
 }

 async function growthDecision(id:string,decision:"approve"|"reject"){
  setBusy("growth:"+id);setError("")
  try{
   const response=await fetch("/api/growth/drafts/"+decision,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({draftId:id})})
   const json=await response.json();if(!response.ok)throw new Error(json.error||"Growth decision failed");await load()
  }catch(cause){setError(cause instanceof Error?cause.message:"Growth decision failed")}
  finally{setBusy(null)}
 }

 const total=memory.length+growth.length+governed.length
 return <main className="jh-page"><div className="jh-wrap">
  <p className="jh-eyebrow">Approval Center</p>
  <h1 className="jh-title">Nothing consequential hides here.</h1>
  <p className="jh-copy">This center only exposes decisions backed by real subsystem state. Memory and Growth have canonical approve/reject endpoints today. Other governed requests stay evidence-only until their owning subsystem exposes a safe mutation contract.</p>
  <div className="jh-grid"><div className="jh-card jh-card--third"><div className="jh-metric">{loading?"—":total}</div><div className="jh-label">Needs attention</div></div><div className="jh-card jh-card--third"><div className="jh-metric">{loading?"—":memory.length}</div><div className="jh-label">Memory</div></div><div className="jh-card jh-card--third"><div className="jh-metric">{loading?"—":growth.length+governed.length}</div><div className="jh-label">Governed work</div></div></div>
  {error&&<div className="jh-error" role="alert">{error}</div>}
  {loading?<div className="jh-list"><div className="jh-skeleton"/><div className="jh-skeleton"/></div>:<>
   {total===0?<div className="jh-empty">All caught up. New approval-required work will appear here only after Jhadina has durable evidence for it.</div>:null}
   {memory.length>0?<section className="jh-section"><h2 className="jh-section-title">Memory proposals</h2><div className="jh-list">{memory.map(candidate=><article className="jh-item" key={candidate.id}>
    <div className="jh-between"><div><span className="jh-status jh-status--warning"><span className="jh-dot"/>Needs approval</span><h3 className="jh-card-title" style={{marginTop:12}}>{candidate.type}</h3><p className="jh-card-copy">{candidate.content}</p><p className="jh-meta">Confidence {Math.round(candidate.confidence*100)}% · proposed memory only</p></div></div>
    <div className="jh-row" style={{marginTop:14}}><button className="jh-button jh-button--primary" disabled={busy==="memory:"+candidate.id} onClick={()=>void memoryDecision(candidate.id,"approve")}>Approve</button><button className="jh-button" disabled={busy==="memory:"+candidate.id} onClick={()=>void memoryDecision(candidate.id,"reject")}>Reject</button></div>
   </article>)}</div></section>:null}
   {growth.length>0?<section className="jh-section"><h2 className="jh-section-title">Growth drafts</h2><div className="jh-list">{growth.map(draft=><article className="jh-item" key={draft.id}>
    <div className="jh-between"><div><span className="jh-status jh-status--warning"><span className="jh-dot"/>Needs approval</span><h3 className="jh-card-title" style={{marginTop:12}}>{draft.title||draft.kind}</h3><p className="jh-card-copy">{draft.body}</p><p className="jh-meta">Why: {draft.rationale} · {draft.platforms.join(" · ")}</p></div><Link className="jh-button" href="/growth">Open Growth</Link></div>
    <div className="jh-row" style={{marginTop:14}}><button className="jh-button jh-button--primary" disabled={busy==="growth:"+draft.id} onClick={()=>void growthDecision(draft.id,"approve")}>Approve</button><button className="jh-button" disabled={busy==="growth:"+draft.id} onClick={()=>void growthDecision(draft.id,"reject")}>Reject</button></div>
   </article>)}</div></section>:null}
   {governed.length>0?<section className="jh-section"><h2 className="jh-section-title">Other governed requests</h2><div className="jh-list">{governed.map(item=><article className="jh-item" key={item.actionId}>
    <div className="jh-between"><div><span className="jh-status jh-status--warning"><span className="jh-dot"/>Approval evidence</span><h3 className="jh-card-title" style={{marginTop:12}}>{item.type}</h3><p className="jh-card-copy">Jhadina’s durable audit ledger records an approval-required transition. This center will not invent an approve button without the owning subsystem’s exact authorization contract.</p><p className="jh-meta">{item.domain} · {new Date(item.timestamp).toLocaleString()} · action {item.actionId}</p></div><Link className="jh-button" href={domainHref[item.domain]??"/worlds"}>Open owner</Link></div>
   </article>)}</div></section>:null}
  </>}
 </div></main>
}
