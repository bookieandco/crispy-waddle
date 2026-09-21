"use client"

import { useEffect, useMemo, useState } from "react"
import { getCurrentUserId } from "@/lib/auth/current-user"
import { auditExecutionState,connectorExecutionState,executionStateLabel,executionStateTone,type JhadinaExecutionState } from "@/lib/system/execution-ux"

type ActivityEvent={
 id:string;actionId:string;type:string;status:"started"|"approval_required"|"completed"|"denied"|"failed";timestamp:string;domain:string;metadata?:Record<string,unknown>
}
type RecoveryExecution={
 id:string;approvalId:string|null;proposalId:string|null;connectorId:string|null;operation:string|null;state:string;startedAt:string;completedAt:string|null;recoveryOfExecutionId:string|null;
 reconciliation:null|{status:string;providerOperation:string|null;providerReference:string|null;observedState:string|null;checkedAt:string}
}
type TimelineItem={
 id:string;source:"audit"|"connector";domain:string;title:string;state:JhadinaExecutionState;timestamp:string;detail:string;actionId?:string;metadata?:Record<string,unknown>
}

function stateTone(state:string){if(["completed","succeeded","recovered","confirmed_executed"].includes(state))return "jh-status jh-status--success";if(["approval_required","recovery_required","executing","unknown","confirmed_not_executed"].includes(state))return "jh-status jh-status--warning";if(["failed","denied"].includes(state))return "jh-status jh-status--danger";return "jh-status"}
function stateLabel(state:string){return state.replaceAll("_"," ").replace(/w/g,letter=>letter.toUpperCase())}

export default function ActivityPage(){
 const [events,setEvents]=useState<ActivityEvent[]>([])
 const [recovery,setRecovery]=useState<RecoveryExecution[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 const [domain,setDomain]=useState("all")
 const [state,setState]=useState("all")

 async function load(){
  setLoading(true);setError("")
  try{
   const userId=await getCurrentUserId();if(!userId)throw new Error("Not signed in")
   const [activityResponse,recoveryResponse]=await Promise.all([
    fetch("/api/system/activity",{cache:"no-store",headers:{"x-jhadina-user-id":userId}}),
    fetch("/api/system/recovery",{cache:"no-store",headers:{"x-jhadina-user-id":userId}}),
   ])
   const activityJson=await activityResponse.json()
   if(!activityResponse.ok)throw new Error(activityJson.error||"Unable to load activity")
   setEvents(activityJson.events??[])
   if(recoveryResponse.ok){const recoveryJson=await recoveryResponse.json();setRecovery(recoveryJson.executions??[])}else setRecovery([])
  }catch(cause){setError(cause instanceof Error?cause.message:"Unable to load activity")}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[])

 const timeline=useMemo<TimelineItem[]>(()=>{
  const audit=events.map<TimelineItem>(event=>({id:"audit:"+event.id,source:"audit",domain:event.domain,title:event.type,state:auditExecutionState(event.status),timestamp:event.timestamp,detail:"Governed ActionAudit event",actionId:event.actionId,metadata:event.metadata}))
  const connectors=recovery.flatMap<TimelineItem>(execution=>{
   const items:TimelineItem[]=[{id:"connector:"+execution.id,source:"connector",domain:"connector",title:execution.operation||execution.connectorId||"Connector execution",state:connectorExecutionState({state:execution.state,recoveryOfExecutionId:execution.recoveryOfExecutionId,reconciliation:execution.reconciliation}),timestamp:execution.startedAt,detail:execution.recoveryOfExecutionId?"Recovery child of "+execution.recoveryOfExecutionId:"Connector execution "+execution.id,actionId:execution.proposalId??execution.approvalId??undefined}]
   if(execution.reconciliation)items.push({id:"reconcile:"+execution.id+":"+execution.reconciliation.checkedAt,source:"connector",domain:"connector",title:execution.reconciliation.providerOperation||execution.operation||"Reconciliation",state:connectorExecutionState({state:execution.state,recoveryOfExecutionId:execution.recoveryOfExecutionId,reconciliation:execution.reconciliation}),timestamp:execution.reconciliation.checkedAt,detail:"Observed provider state: "+(execution.reconciliation.observedState??"not reported"),actionId:execution.proposalId??undefined})
   return items
  })
  return [...audit,...connectors].sort((a,b)=>b.timestamp.localeCompare(a.timestamp))
 },[events,recovery])

 const domains=useMemo(()=>["all",...Array.from(new Set(timeline.map(item=>item.domain))).sort()],[timeline])
 const states=useMemo(()=>["all",...Array.from(new Set(timeline.map(item=>item.state))).sort()],[timeline])
 const visible=timeline.filter(item=>(domain==="all"||item.domain===domain)&&(state==="all"||item.state===state))

 return <main className="jh-page"><div className="jh-wrap">
  <p className="jh-eyebrow">Activity · Black box</p>
  <div className="jh-between"><div><h1 className="jh-title">What happened, in order.</h1><p className="jh-copy">This timeline combines the canonical ActionAudit domains currently implemented in Jhadina Web with actor-scoped connector execution and reconciliation evidence. It does not invent events for subsystems that have not joined those durable stores yet.</p></div><button className="jh-button" onClick={()=>void load()} disabled={loading}>Refresh</button></div>
  <div className="jh-row" style={{marginTop:24}}>
   <label><span className="jh-meta">Domain</span><select className="jh-select" value={domain} onChange={event=>setDomain(event.target.value)}>{domains.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
   <label><span className="jh-meta">State</span><select className="jh-select" value={state} onChange={event=>setState(event.target.value)}>{states.map(value=><option key={value} value={value}>{value==="all"?"all":executionStateLabel(value as JhadinaExecutionState)}</option>)}</select></label>
  </div>
  {error&&<div className="jh-error" role="alert">{error}</div>}
  {loading?<div className="jh-list"><div className="jh-skeleton"/><div className="jh-skeleton"/><div className="jh-skeleton"/></div>:visible.length===0?<div className="jh-empty">No governed evidence matches this filter.</div>:<div className="jh-list">
   {visible.map(item=><details className="jh-item" key={item.id}>
    <summary style={{cursor:"pointer",listStyle:"none"}}><div className="jh-between"><div><p className="jh-eyebrow" style={{marginBottom:6}}>{item.domain} · {item.source}</p><strong>{item.title}</strong><p className="jh-meta" style={{margin:"7px 0 0"}}>{new Date(item.timestamp).toLocaleString()}</p></div><span className={stateClass(item.state)}><span className="jh-dot"/>{executionStateLabel(item.state)}</span></div></summary>
    <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--jh-border)"}}><p className="jh-card-copy">{item.detail}</p>{item.actionId?<p className="jh-meta">Action / proposal: {item.actionId}</p>:null}{item.metadata&&Object.keys(item.metadata).length?<pre style={{overflow:"auto",whiteSpace:"pre-wrap",fontSize:11,color:"var(--jh-muted)"}}>{JSON.stringify(item.metadata,null,2)}</pre>:null}</div>
   </details>)}
  </div>}
  <section className="jh-section"><div className="jh-card jh-card--wide"><h2 className="jh-card-title">Current coverage</h2><p className="jh-card-copy">ActionAudit: Intelligence, Growth, Commerce, Money and Social. Connector black box: execution plus reconciliation. Other worlds remain visible in Worlds and Work, but their domain-specific ledgers are not presented here as universal evidence until a canonical adapter exists.</p></div></section>
 </div></main>
}
