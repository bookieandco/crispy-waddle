"use client"

import { useEffect,useMemo,useState } from "react"
import Link from "next/link"
import { getCurrentUserId } from "@/lib/auth/current-user"

type Event={id:string;actionId:string;domain:string;type:string;status:"started"|"approval_required"|"completed"|"denied"|"failed";timestamp:string;metadata?:Record<string,unknown>}
const label={started:"Executing",approval_required:"Needs approval",completed:"Completed",denied:"Denied",failed:"Failed"} as const

export default function ApprovalCenter(){
  const [events,setEvents]=useState<Event[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("")
  useEffect(()=>{let cancelled=false;(async()=>{try{const userId=await getCurrentUserId();if(!userId)throw new Error("Sign in to view approvals");const res=await fetch("/api/system/activity",{headers:{"x-jhadina-user-id":userId}});const json=await res.json();if(!res.ok)throw new Error(json.error||"Could not load approvals");if(!cancelled)setEvents(json.data?.events??[])}catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Could not load approvals")}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[])
  const actions=useMemo(()=>{const by=new Map<string,Event[]>();for(const e of events){const xs=by.get(e.actionId)||[];xs.push(e);by.set(e.actionId,xs)}return [...by.values()].map(xs=>xs.sort((a,b)=>b.timestamp.localeCompare(a.timestamp))[0]).sort((a,b)=>b.timestamp.localeCompare(a.timestamp))},[events])
  const pending=actions.filter(e=>e.status==="approval_required")
  return <main style={{minHeight:"100vh",background:"var(--jh-bg)",color:"var(--jh-text)",padding:"42px 20px 120px"}}>
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <div style={{fontSize:11,letterSpacing:".2em",textTransform:"uppercase",color:"var(--jh-muted)"}}>Governance</div>
      <h1 style={{fontSize:"clamp(34px,7vw,54px)",letterSpacing:"-.04em",margin:"10px 0"}}>Approval Center</h1>
      <p style={{maxWidth:650,color:"var(--jh-muted)",lineHeight:1.6}}>A read-only universal view of approval state from Jhadina’s canonical durable audit domains. Approval actions are only offered when a subsystem exposes its governed decision endpoint.</p>
      {error&&<div role="alert" style={{marginTop:22,padding:16,border:"1px solid var(--jh-border)",borderRadius:"var(--jh-radius-md)",color:"var(--jh-danger)"}}>{error}</div>}
      <section style={{marginTop:32}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}><h2>Needs you</h2><span style={{color:"var(--jh-muted)"}}>{loading?"—":pending.length}</span></div>
        {!loading&&!error&&pending.length===0&&<div style={{padding:20,border:"1px solid var(--jh-border)",borderRadius:"var(--jh-radius-md)",background:"var(--jh-surface)"}}>No approval-required actions in the current durable domains.</div>}
        <div style={{display:"grid",gap:10}}>{pending.map(e=><article key={e.id} style={{padding:18,border:"1px solid var(--jh-border)",borderRadius:"var(--jh-radius-md)",background:"var(--jh-surface)"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><strong>{e.domain} · {e.type}</strong><span>{label[e.status]}</span></div><p style={{color:"var(--jh-muted)"}}>Action {e.actionId}</p><Link href="/activity">Inspect evidence →</Link></article>)}</div>
      </section>
      <section style={{marginTop:38}}><h2>Lifecycle</h2><div style={{display:"grid",gap:10}}>{actions.filter(e=>e.status!=="approval_required").slice(0,12).map(e=><article key={e.id} style={{padding:16,border:"1px solid var(--jh-border)",borderRadius:"var(--jh-radius-md)",background:"var(--jh-surface)"}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><span>{e.domain} · {e.type}</span><strong>{label[e.status]}</strong></div><small style={{color:"var(--jh-muted)"}}>{new Date(e.timestamp).toLocaleString()}</small></article>)}</div></section>
    </div>
  </main>
}
