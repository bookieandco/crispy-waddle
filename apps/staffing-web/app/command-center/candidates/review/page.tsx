"use client";

import { useState } from "react";

const decisions = ["ADVANCE", "REFER", "HOLD", "REJECT"] as const;

export default function CandidateReviewPage() {
  const [applicationId,setApplicationId]=useState(""); const [note,setNote]=useState(""); const [status,setStatus]=useState<string|null>(null); const [busy,setBusy]=useState(false);
  const organizationId=process.env.NEXT_PUBLIC_STAFFING_ORGANIZATION_ID; const reviewerId=process.env.NEXT_PUBLIC_STAFFING_REVIEWER_ID;
  async function decide(decision:string){ if(!organizationId||!reviewerId||!applicationId){setStatus("Organization, reviewer, and application must be configured.");return;} setBusy(true);setStatus(null); try { const r=await fetch("/api/candidates/decision",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId,reviewerId,applicationId,decision,note})}); const d=await r.json(); if(!r.ok) throw new Error(d.error??"Decision failed"); setStatus(`Recorded: ${decision}`); } catch(e){setStatus(e instanceof Error?e.message:"Unable to record decision");} finally{setBusy(false);} }
  return <main style={{padding:32,maxWidth:800,margin:"0 auto"}}><h1>Candidate Review</h1><p>Make a traceable staffing decision. Every decision is persisted and emits an operational event.</p><label>Application ID<input value={applicationId} onChange={e=>setApplicationId(e.target.value)} style={{display:"block",width:"100%",padding:12,margin:"8px 0 20px"}} /></label><label>Reviewer note<textarea value={note} onChange={e=>setNote(e.target.value)} rows={5} style={{display:"block",width:"100%",padding:12,margin:"8px 0 20px"}} /></label><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{decisions.map(decision=><button key={decision} disabled={busy} onClick={()=>decide(decision)} style={{padding:"12px 18px"}}>{decision}</button>)}</div>{status&&<p role="status" style={{marginTop:20}}>{status}</p>}</main>;
}
