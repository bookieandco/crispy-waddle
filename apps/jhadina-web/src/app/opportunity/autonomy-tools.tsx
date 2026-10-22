"use client"

import { useState } from "react"

type PilotKind = "research_report" | "qualified_leads" | "seo_audit"
type Source = "greenhouse" | "lever"
type JobPreview = {id:string;title:string;sourceUrl:string;sourceName:string;locationLabel:string;remoteMentioned:boolean;eligibilityVerified:false;aiPerformanceAuthorized:false;applicationAuthorized:false}
type Preview = { pilot?: { state: string; document: string; checks: { name:string; passed:boolean }[] }; error?: string }
const field: React.CSSProperties = { width:"100%",border:"1px solid #60736a",borderRadius:9,padding:11,background:"#fff",color:"#17251d",fontSize:16 }
const btn: React.CSSProperties = { padding:"11px 15px",border:0,borderRadius:9,background:"#294c38",color:"#fff",fontWeight:700,cursor:"pointer" }

export default function AutonomyTools({ onImported }: { onImported: () => void }) {
  const [source,setSource]=useState<Source>("greenhouse")
  const [board,setBoard]=useState("")
  const [importResult,setImportResult]=useState("")
  const [kind,setKind]=useState<PilotKind>("research_report")
  const [subject,setSubject]=useState("")
  const [evidence,setEvidence]=useState("")
  const [preview,setPreview]=useState<Preview|null>(null)
  const [busy,setBusy]=useState(false)
  const [jobPreviews,setJobPreviews]=useState<JobPreview[]>([])
  const [readinessStatus,setReadinessStatus]=useState("")
  const [pilotRunId,setPilotRunId]=useState("")
  const [pilotOpportunityId,setPilotOpportunityId]=useState("")
  const [pilotSourceReviewed,setPilotSourceReviewed]=useState(false)
  const [pilotStatus,setPilotStatus]=useState("")
  const [pilotDocument,setPilotDocument]=useState("")
  const [commercialOrderId,setCommercialOrderId]=useState("")
  const [commercialStatus,setCommercialStatus]=useState("")
  async function importJobs(mode:"preview"|"owner_import") {
    setBusy(true);setImportResult("");setJobPreviews([])
    try {
      const sources=board.split(",").map(v=>v.trim()).filter(Boolean).map(board=>({source,board}))
      const res=await fetch("/api/opportunities/discovery/jobs/batch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sources,mode})})
      const json=await res.json()
      if(res.status!==207&&!res.ok)throw new Error(json.error??"Unable to scan")
      setJobPreviews(Array.isArray(json.previews)?json.previews.slice(0,25):[])
      setImportResult(`Scanned ${json.scanned} board(s), found ${json.fetched} listing(s), wrote ${json.persisted??0}; verified database read-back: ${json.verifiedImports??0}. ${json.failed?.length?json.failed.join("; "):"No applications sent. Job eligibility remains unverified."}`)
      if(mode==="owner_import")onImported()
    }catch(error){setImportResult(error instanceof Error?error.message:"Scan failed")}
    finally{setBusy(false)}
  }
  async function runCanonicalPilot(){
    setBusy(true);setPilotStatus("");setPilotDocument("")
    try{
      const response=await fetch("/api/opportunities/pilots/internal-run/from-opportunity",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({opportunityId:pilotOpportunityId,kind,confirmedSourceReview:pilotSourceReviewed})})
      const data=await response.json()
      if(!response.ok){setPilotStatus(data.blockers?.join("; ")??data.error??"Pilot blocked");return}
      setPilotRunId(data.runId)
      setPilotStatus(`Internal report run ${data.runId} checkpointed. Not delivered or paid.`)
      setPilotDocument(data.document??"")
    }catch(error){setPilotStatus(error instanceof Error?error.message:"Pilot unavailable")}
    finally{setBusy(false)}
  }
  async function checkCommercial(){
    setBusy(true);setCommercialStatus("")
    try{
      const response=await fetch("/api/opportunities/pilots/commercial-readiness?workOrderId="+encodeURIComponent(commercialOrderId),{cache:"no-store"})
      const data=await response.json()
      if(!response.ok)throw new Error(data.error??"Commercial verification unavailable")
      setCommercialStatus(`Payment not certified. ${data.review?.blockers?.join("; ")??"Independent Money Core reconciliation pending."}`)
    }catch(error){setCommercialStatus(error instanceof Error?error.message:"Check unavailable")}
    finally{setBusy(false)}
  }
  async function checkReadiness(){
    setBusy(true);setReadinessStatus("")
    try{
      const response=await fetch("/api/opportunities/commissioning/readiness",{cache:"no-store"})
      const data=await response.json()
      if(!response.ok)throw new Error(data.error??"Readiness unavailable")
      const r=data.readiness
      setReadinessStatus(`Account records: ${r.storedOpportunityCount}; public jobs: ${r.publicJobCount}; source-qualified research cases: ${r.potentiallyResearchableCount}. ${r.blockers?.length?r.blockers.join("; "):"Ready for authorized private iPhone canary; not yet certified."}`)
    }catch(error){setReadinessStatus(error instanceof Error?error.message:"Readiness unavailable")}
    finally{setBusy(false)}
  }
  async function recoverPilot(){
    setBusy(true)
    try{
      const response=await fetch("/api/opportunities/pilots/internal-run/"+encodeURIComponent(pilotRunId),{cache:"no-store"})
      const data=await response.json()
      if(!response.ok)throw new Error(data.error??"Run recovery unavailable")
      setPilotDocument(data.run.result?.document??"")
      setPilotStatus(`Persisted run: ${data.run.status}; checkpoint: ${data.run.checkpoint?.reason??"none"}; report hash: ${data.run.result?.reportSha256??"unavailable"}. Read-only, not paid.`)
    }catch(error){setPilotStatus(error instanceof Error?error.message:"Recovery unavailable")}
    finally{setBusy(false)}
  }
  async function makePilot() {
    setBusy(true);setPreview(null)
    try {
      const rows=evidence.split("\n").map(row=>row.trim()).filter(Boolean)
      const observations=rows.map(row=>{
        const [sourceUrl,observedAt,finding,leadSubject]=row.split("|").map(v=>v?.trim()??"")
        return {sourceUrl,observedAt,finding,subject:leadSubject}
      })
      const res=await fetch("/api/opportunities/pilots/preview",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({kind,subject,evidence:observations})})
      const body=await res.json()
      if(!res.ok)throw new Error(body.error??"Preview failed")
      setPreview(body)
    }catch(error){setPreview({error:error instanceof Error?error.message:"Preview failed"})}
    finally{setBusy(false)}
  }
  return <section aria-label="Autonomy research tools" style={{border:"1px solid #b9c6be",borderRadius:14,padding:18,margin:"20px 0",background:"#f6faf6",color:"#1a2b21"}}>
    <h2 style={{fontSize:20,fontWeight:800,margin:"0 0 8px"}}>Opportunity Core · Read-only workbench</h2>
    <p style={{margin:"0 0 14px",fontSize:14}}>Import public employer job listings, then create an internal service draft from attributed observations. No applications, clients, outreach, publishing or payments are triggered.</p>
    <div style={{display:"grid",gap:10}}>
      <label>Public job provider
        <select style={field} value={source} onChange={event=>setSource(event.target.value as Source)}>
          <option value="greenhouse">Greenhouse</option><option value="lever">Lever</option>
        </select>
      </label>
      <label>Company board tokens (up to five, comma-separated)
        <input style={field} autoCapitalize="none" spellCheck={false} value={board} onChange={event=>setBoard(event.target.value)} placeholder="Company careers board slug"/>
      </label>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button style={btn} disabled={busy||!board.trim()} onClick={()=>void importJobs("preview")}>Preview public listings</button>
        <button style={btn} disabled={busy||!board.trim()} onClick={()=>void importJobs("owner_import")}>Import published jobs</button>
      </div>
      {importResult&&<p role="status" style={{fontSize:14,margin:0}}>{importResult}</p>}
      {jobPreviews.length>0&&<div aria-label="Public listing preview" style={{display:"grid",gap:7,maxHeight:320,overflow:"auto"}}>
        {jobPreviews.map(job=><div key={job.id} style={{background:"#fff",padding:10,border:"1px solid #c8d1ca",borderRadius:8}}>
          <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontWeight:700,color:"#294c38"}}>{job.title}</a>
          <div style={{fontSize:12}}>{job.sourceName} · {job.locationLabel}</div>
          <div style={{fontSize:12}}>Remote mentioned: {job.remoteMentioned?"yes":"no"} · Eligibility and AI-work permission: not verified</div>
        </div>)}
      </div>}
      <button style={{...btn,background:"#3b5748"}} disabled={busy} onClick={()=>void checkReadiness()}>Check owner commissioning readiness</button>
      {readinessStatus&&<p role="status" style={{fontSize:13,margin:0}}>{readinessStatus}</p>}
    </div>
    <hr style={{margin:"18px 0",border:"0",borderTop:"1px solid #b9c6be"}}/>
    <div style={{display:"grid",gap:10}}>
      <label>Draft service type
        <select style={field} value={kind} onChange={event=>setKind(event.target.value as PilotKind)}>
          <option value="research_report">Research report</option><option value="qualified_leads">Qualified lead package</option><option value="seo_audit">Website/SEO audit</option>
        </select>
      </label>
      <label>Subject, customer problem, or HTTPS site URL
        <input style={field} value={subject} onChange={event=>setSubject(event.target.value)} placeholder="Business niche, lead segment, or https://site.com"/>
      </label>
      <label>Evidence — one line per observed finding
        <textarea rows={4} style={{...field,fontFamily:"monospace",fontSize:13}} value={evidence} onChange={event=>setEvidence(event.target.value)} placeholder={"https://source.com/page | 2026-10-22 | Observed finding | optional lead subject\nhttps://another-source.com | 2026-10-22 | Second finding | optional lead subject"}/>
      </label>
      <button style={btn} disabled={busy||!subject.trim()} onClick={()=>void makePilot()}>Build internal draft and run QA</button>
      {preview?.error&&<p role="alert">{preview.error}</p>}
      {preview?.pilot&&<div style={{display:"grid",gap:8}}>
        <strong>Draft quality: {preview.pilot.state.replace(/_/g," ")}</strong>
        {preview.pilot.checks.map(check=><span key={check.name} style={{fontSize:13}}>{check.passed?"✓":"⚠"} {check.name}</span>)}
        <details><summary>Inspect report (internal draft)</summary><pre style={{whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:12,maxHeight:420,overflow:"auto"}}>{preview.pilot.document}</pre></details>
      </div>}
    </div>
    <details style={{marginTop:16}}>
      <summary style={{cursor:"pointer",fontWeight:700}}>Run a source-bound internal pilot (no client delivery)</summary>
      <div style={{display:"grid",gap:9,marginTop:10}}>
        <label>Saved canonical Opportunity ID
          <input style={field} value={pilotOpportunityId} onChange={e=>setPilotOpportunityId(e.target.value)} placeholder="opportunity:..."/>
        </label>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
          <input type="checkbox" checked={pilotSourceReviewed} onChange={e=>setPilotSourceReviewed(e.target.checked)}/>
          I reviewed the canonical source excerpts for this draft.
        </label>
        <button style={btn} disabled={busy||!pilotOpportunityId.trim()||!pilotSourceReviewed} onClick={()=>void runCanonicalPilot()}>Create governed internal report</button>
        {pilotRunId&&<button style={{...btn,background:"#3b5748"}} disabled={busy} onClick={()=>void recoverPilot()}>Reload saved run and report</button>}
        {pilotStatus&&<p role="status" style={{fontSize:13}}>{pilotStatus}</p>}
        {pilotDocument&&<details><summary>Read internal report</summary><pre style={{whiteSpace:"pre-wrap",wordBreak:"break-word",fontSize:12}}>{pilotDocument}</pre></details>}
      </div>
    </details>
    <details style={{marginTop:14}}>
      <summary style={{cursor:"pointer",fontWeight:700}}>Commercial acceptance status (read only)</summary>
      <div style={{display:"grid",gap:9,marginTop:10}}>
        <label>Existing governed commercial work-order ID
          <input style={field} value={commercialOrderId} onChange={e=>setCommercialOrderId(e.target.value)} placeholder="work-order:..."/>
        </label>
        <button style={btn} disabled={busy||!commercialOrderId.trim()} onClick={()=>void checkCommercial()}>Check delivery and financial blockers</button>
        {commercialStatus&&<p role="status" style={{fontSize:13}}>{commercialStatus}</p>}
      </div>
    </details>
  </section>
}
