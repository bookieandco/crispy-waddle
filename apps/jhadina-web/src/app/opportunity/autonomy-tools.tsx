"use client"

import { useState } from "react"

type PilotKind = "research_report" | "qualified_leads" | "seo_audit"
type Source = "greenhouse" | "lever"
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
  async function importJobs() {
    setBusy(true);setImportResult("")
    try {
      const res=await fetch("/api/opportunities/discovery/jobs",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({source,board})})
      const body=await res.json()
      if(!res.ok)throw new Error(body.error??"Unable to import")
      setImportResult(`Imported ${body.imported} public job records into the Opportunity queue. No applications sent.`)
      onImported()
    }catch(error){setImportResult(error instanceof Error?error.message:"Import failed")}
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
      <label>Company board token
        <input style={field} autoCapitalize="none" spellCheck={false} value={board} onChange={event=>setBoard(event.target.value)} placeholder="Company careers board slug"/>
      </label>
      <button style={btn} disabled={busy||!board.trim()} onClick={()=>void importJobs()}>Import up to 25 published jobs</button>
      {importResult&&<p role="status" style={{fontSize:14,margin:0}}>{importResult}</p>}
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
  </section>
}
