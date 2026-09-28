"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { getCurrentUserId } from "@/lib/auth/current-user"

type MemoryCandidate={id:string;content:string;type:string;confidence:number;status:string;createdAt?:string}
type GrowthDraft={id:string;brand:string;kind:string;title?:string;body:string;rationale:string;status:string;platforms:string[]}
type SocialTarget={accountId:string;platform:string;provider:string;providerProfileId:string;brand:string}
type SocialProposal={id:string;actionId:string;brand:string;text:string;targets:SocialTarget[];status:string;approvalReceiptId?:string;createdAt:string;scheduledAt?:string}
type MoneyMovement={
 movement_id:string;coffer_id:string;kind:"DEPOSIT"|"WITHDRAWAL"|"TRANSFER";amount_minor:string|number;currency:string;source_id:string;destination_id:string;
 state:string;approval_receipt_id:string|null;approvalStatus:string|null;approvalExpiresAt:string|null;created_at:string;updated_at:string
}
type ActivityEvent={id:string;actionId:string;type:string;status:"started"|"approval_required"|"completed"|"denied"|"failed";timestamp:string;domain:string;metadata?:Record<string,unknown>}
type GovernedApproval={actionId:string;type:string;domain:string;timestamp:string;state:"needs_review"|"resolved";terminal?:ActivityEvent["status"]}

const domainHref:Record<string,string>={
 intelligence:"/ask-jhadina",growth:"/growth",commerce:"/worlds",money:"/money/command-center",social:"/social"
}

export default function ApprovalsPage(){
 const [memory,setMemory]=useState<MemoryCandidate[]>([])
 const [growth,setGrowth]=useState<GrowthDraft[]>([])
 const [social,setSocial]=useState<SocialProposal[]>([])
 const [money,setMoney]=useState<MoneyMovement[]>([])
 const [events,setEvents]=useState<ActivityEvent[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 const [busy,setBusy]=useState<string|null>(null)

 async function load(){
  setLoading(true);setError("")
  try{
   const userId=await getCurrentUserId()
   if(!userId)throw new Error("Not signed in")
   const [candidateRes,growthRes,socialRes,moneyRes,activityRes]=await Promise.all([
    fetch("/api/candidates",{cache:"no-store",headers:{"x-user-id":userId}}),
    fetch("/api/growth/drafts",{cache:"no-store"}),
    fetch("/api/social/posts",{cache:"no-store"}),
    fetch("/api/money/movement-proposals",{cache:"no-store",credentials:"same-origin"}),
    fetch("/api/system/activity",{cache:"no-store",headers:{"x-jhadina-user-id":userId}}),
   ])
   const [candidateJson,growthJson,socialJson,moneyJson,activityJson]=await Promise.all([candidateRes.json(),growthRes.json(),socialRes.json(),moneyRes.json(),activityRes.json()])
   if(!candidateRes.ok)throw new Error(candidateJson.error||"Unable to load memory approvals")
   if(!growthRes.ok)throw new Error(growthJson.error||"Unable to load Growth approvals")
   if(!socialRes.ok)throw new Error(socialJson.error||"Unable to load Social approvals")
   if(!moneyRes.ok)throw new Error(moneyJson.error||"Unable to load Money approvals")
   if(!activityRes.ok)throw new Error(activityJson.error||"Unable to load governed approvals")
   setMemory(candidateJson.data?.candidates??[])
   setGrowth((growthJson.data?.drafts??[]).filter((draft:GrowthDraft)=>draft.status==="PENDING_APPROVAL"))
   setSocial((socialJson.data??[]).filter((proposal:SocialProposal)=>proposal.status==="pending_approval"&&proposal.approvalReceiptId))
   setMoney((moneyJson.data?.proposals??[]).filter((proposal:MoneyMovement)=>proposal.state==="PENDING_APPROVAL"))
   setEvents(activityJson.events??[])
  }catch(cause){setError(cause instanceof Error?cause.message:"Unable to load approvals")}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[])

 const governed=useMemo<GovernedApproval[]>(()=>{
  const requests=new Map<string,ActivityEvent>()
  for(const event of events){
   if(event.status==="approval_required"&&!["growth","social","money"].includes(event.domain)){
    const previous=requests.get(event.actionId)
    if(!previous||previous.timestamp<event.timestamp)requests.set(event.actionId,event)
   }
  }
  return [...requests.values()].filter(request=>!["growth","social","intelligence","money"].includes(request.domain)).map(request=>{
   const later=events.filter(event=>event.actionId===request.actionId&&event.timestamp>request.timestamp&&["completed","denied","failed"].includes(event.status)).sort((a,b)=>b.timestamp.localeCompare(a.timestamp))[0]
   const item:GovernedApproval={actionId:request.actionId,type:request.type,domain:request.domain,timestamp:request.timestamp,state:later?"resolved":"needs_review",terminal:later?.status};return item
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

 async function socialApprove(proposal:SocialProposal){
  if(!proposal.approvalReceiptId)return
  setBusy("social:"+proposal.id);setError("")
  try{
   const response=await fetch("/api/social/posts/"+proposal.id+"/approve",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({approvalReceiptId:proposal.approvalReceiptId})})
   const json=await response.json();if(!response.ok)throw new Error(json.error||"Social publication approval failed");await load()
  }catch(cause){setError(cause instanceof Error?cause.message:"Social publication approval failed")}
  finally{setBusy(null)}
 }

 async function moneyDecision(proposal:MoneyMovement,decision:"approve"|"reject"){
  setBusy("money:"+proposal.movement_id);setError("")
  try{
   const response=await fetch("/api/money/movement-proposals/"+proposal.movement_id+"/"+decision,{method:"POST",credentials:"same-origin"})
   const json=await response.json();if(!response.ok)throw new Error(json.error||"Money movement decision failed");await load()
  }catch(cause){setError(cause instanceof Error?cause.message:"Money movement decision failed")}
  finally{setBusy(null)}
 }

 const total=memory.length+growth.length+social.length+money.length+governed.length
 const governedWork=growth.length+social.length+money.length+governed.length
 return <main className="jh-page"><div className="jh-wrap">
  <p className="jh-eyebrow">Approval Center</p>
  <h1 className="jh-title">Nothing consequential hides here.</h1>
  <p className="jh-copy">Every actionable control below maps to an existing subsystem authorization contract. Money approvals are fingerprint-bound and still cannot move funds by themselves: a separate Money execution permit, commissioned live rail, provider evidence and reconciliation remain mandatory.</p>
  <div className="jh-grid"><div className="jh-card jh-card--third"><div className="jh-metric">{loading?"—":total}</div><div className="jh-label">Needs attention</div></div><div className="jh-card jh-card--third"><div className="jh-metric">{loading?"—":money.length}</div><div className="jh-label">Money</div></div><div className="jh-card jh-card--third"><div className="jh-metric">{loading?"—":governedWork}</div><div className="jh-label">Governed work</div></div></div>
  {error&&<div className="jh-error" role="alert">{error}</div>}
  {loading?<div className="jh-list"><div className="jh-skeleton"/><div className="jh-skeleton"/></div>:<>
   {total===0?<div className="jh-empty">All caught up. New approval-required work will appear here only after Jhadina has durable evidence for it.</div>:null}
   {money.length>0?<section className="jh-section"><h2 className="jh-section-title">Money movements</h2><div className="jh-list">{money.map(proposal=>{
    const expired=proposal.approvalExpiresAt?Date.parse(proposal.approvalExpiresAt)<=Date.now():false
    return <article className="jh-item" key={proposal.movement_id}>
     <div className="jh-between"><div><span className="jh-status jh-status--warning"><span className="jh-dot"/>{expired?"Approval expired":"Needs owner approval"}</span><h3 className="jh-card-title" style={{marginTop:12}}>{moneyLabel(proposal.kind)} · {moneyAmount(proposal.amount_minor,proposal.currency)}</h3><p className="jh-card-copy">{proposal.source_id} → {proposal.destination_id}</p><p className="jh-meta">Receipt {proposal.approval_receipt_id??"missing"} · {proposal.approvalExpiresAt?"expires "+new Date(proposal.approvalExpiresAt).toLocaleString():"expiry unavailable"} · approval alone cannot move money</p></div><Link className="jh-button" href="/money/funding">Open Funding</Link></div>
     <div className="jh-row" style={{marginTop:14}}><button className="jh-button jh-button--primary" disabled={expired||busy==="money:"+proposal.movement_id||!proposal.approval_receipt_id} onClick={()=>void moneyDecision(proposal,"approve")}>Approve</button><button className="jh-button" disabled={busy==="money:"+proposal.movement_id} onClick={()=>void moneyDecision(proposal,"reject")}>Reject</button></div>
     <p className="jh-meta">After approval: execution permit → live rail policy → single-submit provider attempt → settlement reconciliation.</p>
    </article>
   })}</div></section>:null}
   {memory.length>0?<section className="jh-section"><h2 className="jh-section-title">Memory proposals</h2><div className="jh-list">{memory.map(candidate=><article className="jh-item" key={candidate.id}>
    <div className="jh-between"><div><span className="jh-status jh-status--warning"><span className="jh-dot"/>Needs approval</span><h3 className="jh-card-title" style={{marginTop:12}}>{candidate.type}</h3><p className="jh-card-copy">{candidate.content}</p><p className="jh-meta">Confidence {Math.round(candidate.confidence*100)}% · proposed memory only</p></div></div>
    <div className="jh-row" style={{marginTop:14}}><button className="jh-button jh-button--primary" disabled={busy==="memory:"+candidate.id} onClick={()=>void memoryDecision(candidate.id,"approve")}>Approve</button><button className="jh-button" disabled={busy==="memory:"+candidate.id} onClick={()=>void memoryDecision(candidate.id,"reject")}>Reject</button></div>
   </article>)}</div></section>:null}
   {growth.length>0?<section className="jh-section"><h2 className="jh-section-title">Growth drafts</h2><div className="jh-list">{growth.map(draft=><article className="jh-item" key={draft.id}>
    <div className="jh-between"><div><span className="jh-status jh-status--warning"><span className="jh-dot"/>Needs approval</span><h3 className="jh-card-title" style={{marginTop:12}}>{draft.title||draft.kind}</h3><p className="jh-card-copy">{draft.body}</p><p className="jh-meta">Why: {draft.rationale} · {draft.platforms.join(" · ")}</p></div><Link className="jh-button" href="/growth">Open Growth</Link></div>
    <div className="jh-row" style={{marginTop:14}}><button className="jh-button jh-button--primary" disabled={busy==="growth:"+draft.id} onClick={()=>void growthDecision(draft.id,"approve")}>Approve</button><button className="jh-button" disabled={busy==="growth:"+draft.id} onClick={()=>void growthDecision(draft.id,"reject")}>Reject</button></div>
   </article>)}</div></section>:null}
   {social.length>0?<section className="jh-section"><h2 className="jh-section-title">Social publication</h2><div className="jh-list">{social.map(proposal=><article className="jh-item" key={proposal.id}>
    <div className="jh-between"><div><span className="jh-status jh-status--warning"><span className="jh-dot"/>Provider call blocked</span><h3 className="jh-card-title" style={{marginTop:12}}>{proposal.brand}</h3><p className="jh-card-copy">{proposal.text}</p><p className="jh-meta">{proposal.targets.map(target=>target.platform+" · "+target.providerProfileId).join(" · ")} · receipt {proposal.approvalReceiptId}</p></div><Link className="jh-button" href="/social">Open Social</Link></div>
    <div className="jh-row" style={{marginTop:14}}><button className="jh-button jh-button--primary" disabled={busy==="social:"+proposal.id} onClick={()=>void socialApprove(proposal)}>{busy==="social:"+proposal.id?"Publishing…":"Approve & publish"}</button></div>
    <p className="jh-meta">This action consumes the exact stored approval receipt and then enters Social’s governed ActionExecutor/outbox. No generic reject mutation exists, so this center does not invent one.</p>
   </article>)}</div></section>:null}
   {governed.length>0?<section className="jh-section"><h2 className="jh-section-title">Other governed requests</h2><div className="jh-list">{governed.map(item=><article className="jh-item" key={item.actionId}>
    <div className="jh-between"><div><span className="jh-status jh-status--warning"><span className="jh-dot"/>Approval evidence</span><h3 className="jh-card-title" style={{marginTop:12}}>{item.type}</h3><p className="jh-card-copy">Jhadina’s durable audit ledger records an approval-required transition. This center will not invent an approve button without the owning subsystem’s exact authorization contract.</p><p className="jh-meta">{item.domain} · {new Date(item.timestamp).toLocaleString()} · action {item.actionId}</p></div><Link className="jh-button" href={domainHref[item.domain]??"/worlds"}>Open owner</Link></div>
   </article>)}</div></section>:null}
  </>}
 </div></main>
}

function moneyLabel(kind:MoneyMovement["kind"]){return kind==="DEPOSIT"?"Add funds":kind==="WITHDRAWAL"?"Cash out":"Transfer"}
function moneyAmount(value:string|number,currency:string){return new Intl.NumberFormat("en-US",{style:"currency",currency}).format(Number(value)/100)}
