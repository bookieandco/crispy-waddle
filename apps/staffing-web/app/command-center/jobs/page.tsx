"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Job = { id:string; title:string; employerName:string; location?:string; status:string; openings:number; candidateCount:number; qualifiedCandidateCount:number; createdAt:string };

export default function JobsCommandCenterPage() {
  const [jobs,setJobs]=useState<Job[]>([]); const [error,setError]=useState<string|null>(null);
  const organizationId=process.env.NEXT_PUBLIC_STAFFING_ORGANIZATION_ID;
  useEffect(()=>{ if(!organizationId){setError("No staffing organization is configured.");return;} fetch(`/api/jobs?organizationId=${encodeURIComponent(organizationId)}`,{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(new Error("Jobs unavailable"))).then(d=>setJobs(d.jobs??[])).catch(e=>setError(e instanceof Error?e.message:"Unable to load jobs")); },[organizationId]);
  return <main style={{padding:32,maxWidth:1280,margin:"0 auto"}}><header><Link href="/command-center">← Mission Control</Link><p style={{opacity:.55,letterSpacing:1}}>OPERATIONS</p><h1>Jobs</h1><p>Manage open demand and move qualified candidates toward placement.</p></header>{error&&<section role="alert" style={{padding:16,border:"1px solid currentColor",margin:"24px 0"}}>{error}</section>}<section style={{marginTop:32,borderTop:"1px solid #ddd"}}>{jobs.map(job=><article key={job.id} style={{padding:"20px 0",borderBottom:"1px solid #eee",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:16}}><div><strong>{job.title}</strong><div style={{opacity:.6}}>{job.employerName}{job.location?` · ${job.location}`:""}</div></div><div><small>Openings</small><br/>{job.openings}</div><div><small>Candidates</small><br/>{job.candidateCount} · {job.qualifiedCandidateCount} qualified</div><div><small>Status</small><br/>{job.status}</div></article>)}{!jobs.length&&!error&&<p style={{padding:"24px 0",opacity:.6}}>No open jobs found.</p>}</section></main>;
}
