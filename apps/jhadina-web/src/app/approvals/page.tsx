"use client"
import { useEffect,useState } from "react"
import Link from "next/link"
import { getCurrentUserId } from "@/lib/auth/current-user"

type Approval={actionId:string;domain:string;capability:string;state:"requested"|"executing"|"completed"|"denied"|"failed"|"recovery_required"|"reconciled"|"recovered";updatedAt:string;evidence:{source:"action_audit";eventId:string;status:string;timestamp:string}[]}
const label={requested:"Needs approval",executing:"Executing",completed:"Completed",denied:"Denied",failed:"Failed",recovery_required:"Recovery required",reconciled:"Reconciled",recovered:"Recovered"} as const

export default function ApprovalCenter(){
 const [actions,setActions]=useState<Approval[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("")
 useEffect(()=>{let cancelled=false;(async()=>{try{const userId=await getCurrentUserId();if(!userId)throw new Error("Sign in to view approvals");const res=await fetch("/api/system/approvals",{headers:{"x-jhadina-user-id":userId}});const json=await res.json();if(!res.ok)throw new Error(json.error||"Could not load approvals");if(!cancelled)setActions(json.data?.approvals??[])}catch(e){if(!cancelled)setError(e instanceof Error?e.message:"Could not load approvals")}finally{if(!cancelled)setLoading(false)}})();return()=>{cancelled=true}},[])
 const pending=actions.filter(a=>a.state==="requested")
 return <main style={{minHeight:"100vh",background:"var(--jh-bg)",color:"var(--jh-text)",padding:"42px 20px 120px"}}><div style={{maxWidth:900,margin:"0 auto"}}>
  <div style={{fontSize:11,letterSpacing:".2em",textTransform:"uppercase",color:"var(--jh-muted)"}}>Governance · evidence backed</div>
  <h1 style={{fontSize:"clamp(34px,7vw,54px)",letterSpacing:"-.04em",margin:"10px 0"}}>Approval Center</h1>
  <p style={{maxWidth:680,color:"var(--jh-muted)",lineHeight:1.6}}>Each state below is projected from canonical durable evidence. Recovery states are shown only when actor-scoped connector execution and reconciliation evidence proves them. Approved and Verifying remain unavailable until their backing evidence is universal.</p>
  {error&&<div role="alert" style={{marginTop:22,padding:16,border:"1px solid var(--jh-border)",borderRadius:"var(--jh-radius-md)",color:"var(--jh-danger)"}}>{error}</div>}
  <section style={{marginTop:32}}><div style={{display:"flex",justifyContent:"space-between"}}><h2>Needs you</h2><span>{loading?"—":pending.length}</span></div>
   {!loading&&!error&&pending.length===0&&<div style={{padding:20,border:"1px solid var(--jh-border)",borderRadius:"var(--jh-radius-md)",background:"var(--jh-surface)"}}>No approval requests are proven by the current durable projection.</div>}
   <div style={{display:"grid",gap:10}}>{pending.map(a=><article key={a.domain+":"+a.actionId} style={{padding:18,border:"1px solid var(--jh-border)",borderRadius:"var(--jh-radius-md)",background:"var(--jh-surface)"}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><strong>{a.domain} · {a.capability}</strong><span>{label[a.state]}</span></div><p style={{color:"var(--jh-muted)"}}>Action {a.actionId} · {a.evidence.length} audit evidence item{a.evidence.length===1?"":"s"}</p><Link href="/activity">Inspect evidence →</Link></article>)}</div>
  </section>
  <section style={{marginTop:38}}><h2>Lifecycle</h2><div style={{display:"grid",gap:10}}>{actions.filter(a=>a.state!=="requested").slice(0,12).map(a=><article key={a.domain+":"+a.actionId} style={{padding:16,border:"1px solid var(--jh-border)",borderRadius:"var(--jh-radius-md)",background:"var(--jh-surface)"}}><div style={{display:"flex",justifyContent:"space-between",gap:12}}><span>{a.domain} · {a.capability}</span><strong>{label[a.state]}</strong></div><small style={{color:"var(--jh-muted)"}}>{new Date(a.updatedAt).toLocaleString()} · source: ActionAudit</small></article>)}</div></section>
 </div></main>
}
