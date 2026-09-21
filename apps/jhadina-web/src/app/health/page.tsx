"use client"

import { useEffect, useState } from "react"
import { getCurrentUserId } from "@/lib/auth/current-user"

type Check={id:string;label:string;status:"ready"|"degraded"|"unknown";detail:string}

export default function HealthPage(){
 const [checks,setChecks]=useState<Check[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 async function load(){
  setLoading(true);setError("")
  const next:Check[]=[]
  try{
   const userId=await getCurrentUserId()
   if(!userId)throw new Error("Not signed in")
   try{
    const response=await fetch("/api/system/activity",{cache:"no-store",headers:{"x-jhadina-user-id":userId}})
    const json=await response.json()
    next.push({id:"audit",label:"Governed audit boundary",status:response.ok?"ready":"degraded",detail:response.ok?"Actor-scoped ActionAudit read succeeded.":json.error||"Audit read failed."})
   }catch{next.push({id:"audit",label:"Governed audit boundary",status:"degraded",detail:"Audit read could not be reached."})}
   try{
    const response=await fetch("/api/system/recovery",{cache:"no-store",headers:{"x-jhadina-user-id":userId}})
    const json=await response.json()
    next.push({id:"recovery",label:"Connector black box",status:response.ok?"ready":"degraded",detail:response.ok?"Actor-scoped execution/reconciliation read succeeded.":json.error||"Recovery evidence unavailable."})
   }catch{next.push({id:"recovery",label:"Connector black box",status:"degraded",detail:"Recovery evidence could not be reached."})}
   try{
    const response=await fetch("/api/spatial/health",{cache:"no-store"})
    const json=await response.json()
    next.push({id:"spatial",label:"Spatial production gate",status:json.status==="READY"?"ready":"degraded",detail:"Spatial reports "+(json.status??"UNKNOWN")+". This is its own fail-closed production health contract."})
   }catch{next.push({id:"spatial",label:"Spatial production gate",status:"unknown",detail:"No Spatial health response was available."})}
   setChecks(next)
  }catch(cause){setError(cause instanceof Error?cause.message:"Unable to read system status")}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[])
 return <main className="jh-page"><div className="jh-wrap">
  <p className="jh-eyebrow">System status</p>
  <div className="jh-between"><div><h1 className="jh-title">Evidence, not green lights.</h1><p className="jh-copy">This page only reports runtime checks backed by real endpoints. The legacy generic <code>/api/health</code> endpoint is intentionally not treated as authoritative because older audits identified hard-coded status behavior.</p></div><button className="jh-button" onClick={()=>void load()} disabled={loading}>Refresh</button></div>
  {error&&<div className="jh-error" role="alert">{error}</div>}
  {loading?<div className="jh-list"><div className="jh-skeleton"/><div className="jh-skeleton"/></div>:<div className="jh-list">{checks.map(check=><article className="jh-item" key={check.id}><div className="jh-between"><div><h2 className="jh-card-title">{check.label}</h2><p className="jh-card-copy">{check.detail}</p></div><span className={check.status==="ready"?"jh-status jh-status--success":check.status==="degraded"?"jh-status jh-status--warning":"jh-status"}><span className="jh-dot"/>{check.status}</span></div></article>)}</div>}
  <section className="jh-section"><div className="jh-card jh-card--wide"><h2 className="jh-card-title">What this does not claim</h2><p className="jh-card-copy">A successful audit read does not prove every Jhadina subsystem is healthy. Each world keeps its own production gate until it exposes a canonical health adapter. This surface will expand by adding evidence adapters, not decorative status.</p></div></section>
 </div></main>
}
