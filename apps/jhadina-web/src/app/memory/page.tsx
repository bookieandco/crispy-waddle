"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { getCurrentUserId } from "@/lib/auth/current-user"

type Memory={id:string;content:string;type:string;status:string;confidence:number;createdAt?:string;approvedAt?:string}

export default function MemoryPage(){
 const [memories,setMemories]=useState<Memory[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 const [query,setQuery]=useState("")
 const [busy,setBusy]=useState<string|null>(null)
 const [editing,setEditing]=useState<string|null>(null)
 const [revision,setRevision]=useState("")

 async function load(){
  setLoading(true);setError("")
  try{
   const userId=await getCurrentUserId();if(!userId)throw new Error("Not signed in")
   const response=await fetch("/api/memories",{cache:"no-store",headers:{"x-user-id":userId}})
   const json=await response.json();if(!response.ok)throw new Error(json.error||"Unable to load memory")
   setMemories(json.data?.memories??[])
  }catch(cause){setError(cause instanceof Error?cause.message:"Unable to load memory")}
  finally{setLoading(false)}
 }

 async function changeMemory(memory:Memory,mode:"correct"|"forget"){
  if(mode==="forget" && !window.confirm("Remove this memory from Jhadina's active recall? Historical audit records may remain."))return
  if(mode==="correct" && (!revision.trim() || revision.trim().length>4000)) {
   setError("Correction must contain 1–4000 characters.");return
  }
  setBusy(memory.id);setError("")
  try{
   const userId=await getCurrentUserId();if(!userId)throw new Error("Not signed in")
   const response=await fetch("/api/memory/"+mode,{
    method:"POST",credentials:"same-origin",
    headers:{"content-type":"application/json","x-user-id":userId},
    body:JSON.stringify(mode==="correct"?{memoryId:memory.id,content:revision.trim()}:{memoryId:memory.id}),
   })
   const json=await response.json()
   if(!response.ok)throw new Error(json.error||"Memory update failed")
   setEditing(null);setRevision("")
   await load()
  }catch(cause){setError(cause instanceof Error?cause.message:"Memory update failed")}
  finally{setBusy(null)}
 }
 useEffect(()=>{void load()},[])
 const visible=useMemo(()=>{const q=query.trim().toLowerCase();return q?memories.filter(memory=>(memory.content+" "+memory.type).toLowerCase().includes(q)):memories},[memories,query])
 return <main className="jh-page"><div className="jh-wrap">
  <p className="jh-eyebrow">Memory</p>
  <div className="jh-between"><div><h1 className="jh-title">What Jhadina is allowed to remember.</h1><p className="jh-copy">This surface lists approved memory only. Pending candidates stay in Approval Center so proposals cannot be mistaken for durable memory.</p></div><Link className="jh-button" href="/approvals">Pending approvals</Link></div>
  <div style={{marginTop:18}}><Link className="jh-button" href="/memory/facebook">Import your Facebook writing</Link></div>
  <p className="jh-meta">Correcting and forgetting remove old memories from active recall, but the canonical audit history remains for provenance. Full historical erasure is a separate data-retention request.</p>
  <div style={{marginTop:24,maxWidth:560}}><input className="jh-input" aria-label="Search approved memories" placeholder="Search approved memory…" value={query} onChange={event=>setQuery(event.target.value)}/></div>
  {error&&<div className="jh-error" role="alert">{error}</div>}
  {loading?<div className="jh-list"><div className="jh-skeleton"/><div className="jh-skeleton"/></div>:visible.length===0?<div className="jh-empty">{query?"No approved memories match this search.":"No approved memories yet."}</div>:<div className="jh-list">{visible.map(memory=><article className="jh-item" key={memory.id}>
   <div className="jh-between"><div><span className="jh-status jh-status--success"><span className="jh-dot"/>Approved</span><h2 className="jh-card-title" style={{marginTop:12}}>{memory.type}</h2><p className="jh-card-copy">{memory.content}</p></div><div style={{textAlign:"right"}}><div className="jh-metric" style={{fontSize:26}}>{Math.round(memory.confidence*100)}%</div><div className="jh-label">Confidence</div></div></div>
   <p className="jh-meta">{memory.approvedAt?"Approved "+new Date(memory.approvedAt).toLocaleString():memory.createdAt?"Created "+new Date(memory.createdAt).toLocaleString():"Approved memory"} · {memory.id}</p>
   <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:12}}>
    <button className="jh-button" type="button" disabled={busy!==null} onClick={()=>{setEditing(memory.id);setRevision(memory.content)}}>Correct memory</button>
    <button className="jh-button" type="button" disabled={busy!==null} onClick={()=>{void changeMemory(memory,"forget")}}>Forget from active recall</button>
   </div>
   {editing===memory.id?<div style={{marginTop:12}}>
    <label className="jh-label" htmlFor={"memory-correction-"+memory.id}>Replacement memory</label>
    <textarea className="jh-input" id={"memory-correction-"+memory.id} rows={4} maxLength={4000} value={revision} onChange={event=>setRevision(event.target.value)}/>
    <div style={{display:"flex",gap:10,marginTop:10}}>
     <button className="jh-button" type="button" disabled={busy!==null || !revision.trim()} onClick={()=>{void changeMemory(memory,"correct")}}>Save correction</button>
     <button className="jh-button" type="button" disabled={busy!==null} onClick={()=>{setEditing(null);setRevision("")}}>Cancel</button>
    </div>
   </div>:null}

  </article>)}</div>}
 </div></main>
}
