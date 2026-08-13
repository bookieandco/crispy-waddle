"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Candidate = { id:string; name:string; jobTitle:string; status:string; matchScore?:number; submittedAt?:string; };

export default function CandidatesCommandCenterPage() {
  const [candidates,setCandidates]=useState<Candidate[]>([]); const [error,setError]=useState<string|null>(null);
  const organizationId=process.env.NEXT_PUBLIC_STAFFING_ORGANIZATION_ID;
  useEffect(()=>{ if(!organizationId){setError("No staffing organization is configured.");return;} fetch(`/api/candidates?organizationId=${encodeURIComponent(organizationId)}`,{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(new Error("Candidates unavailable"))).then(d=>setCandidates(d.candidates??[])).catch(e=>setError(e instanceof Error?e.message:"Unable to load candidates")); },[organizationId]);
  return <main style={{padding:32,maxWidth:1280,margin:"0 auto"}}><header><Link href="/command-center">← Mission Control</Link><p style={{opacity:.55,letterSpacing:1}}>TALENT</p><h1>Candidates</h1><p>Review qualified candidates and move strong matches toward referral and placement.</p></header>{error&&<section role="alert" style={{padding:16,border:"1px solid currentColor",margin:"24px 0"}}>{error}</section>}<section style={{marginTop:32,borderTop:"1px solid #ddd"}}>{candidates.map(candidate=><article key={candidate.id} style={{padding:"20px 0",borderBottom:"1px solid #eee",display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr",gap:16}}><div><strong>{candidate.name}</strong><div style={{opacity:.6}}>{candidate.jobTitle}</div></div><div><small>Status</small><br/>{candidate.status}</div><div><small>Match</small><br/>{candidate.matchScore != null ? `${candidate.matchScore}%` : "—"}</div><div><small>Submitted</small><br/>{candidate.submittedAt ? new Date(candidate.submittedAt).toLocaleDateString() : "—"}</div></article>)}{!candidates.length&&!error&&<p style={{padding:"24px 0",opacity:.6}}>No candidates awaiting review.</p>}</section></main>;
}
