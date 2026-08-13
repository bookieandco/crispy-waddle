"use client";

import { useEffect, useState } from "react";

type Summary = { outstanding:number; partiallyPaid:number; paid:number; paymentsReceived:number; agencyRevenue:number; platformRevenue:number; currency:string };
type Activity = { kind:string; id:string; placementId?:string; amount:number; currency:string; status:string; occurredAt:string };

export default function FinancePage() {
  const [summary,setSummary]=useState<Summary|null>(null);
  const [activity,setActivity]=useState<Activity[]>([]);
  const [error,setError]=useState<string|null>(null);
  const organizationId=process.env.NEXT_PUBLIC_STAFFING_ORGANIZATION_ID;
  useEffect(()=>{
    if(!organizationId){setError("No staffing organization is configured.");return;}
    Promise.all([
      fetch(`/api/finance/summary?organizationId=${encodeURIComponent(organizationId)}`,{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(new Error("Finance summary unavailable"))),
      fetch(`/api/finance/activity?organizationId=${encodeURIComponent(organizationId)}&limit=25`,{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(new Error("Finance activity unavailable")))
    ]).then(([s,a])=>{setSummary(s);setActivity(a.activity??[])}).catch(e=>setError(e instanceof Error?e.message:"Unable to load finance data"));
  },[organizationId]);
  const money=(n:number,currency:string)=>new Intl.NumberFormat(undefined,{style:"currency",currency}).format(n);
  return <main style={{padding:32,maxWidth:1280,margin:"0 auto"}}><header><p style={{opacity:.6}}>STAFFING COMMAND CENTER</p><h1>Finance</h1><p>Financial awareness, decisions, and control.</p></header>{error&&<section role="alert" style={{padding:16,border:"1px solid currentColor",margin:"24px 0"}}>{error}</section>}{summary&&<><section style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,margin:"32px 0"}}>{[["Outstanding",summary.outstanding],["Partially Paid",summary.partiallyPaid],["Paid",summary.paid],["Collected",summary.paymentsReceived]].map(([label,value])=><article key={String(label)} style={{padding:20,border:"1px solid #ddd",borderRadius:12}}><small>{label}</small><h2>{money(Number(value),summary.currency)}</h2></article>)}</section><section style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><article style={{padding:20,border:"1px solid #ddd",borderRadius:12}}><small>Agency Revenue</small><h2>{money(summary.agencyRevenue,summary.currency)}</h2></article><article style={{padding:20,border:"1px solid #ddd",borderRadius:12}}><small>Platform Revenue</small><h2>{money(summary.platformRevenue,summary.currency)}</h2></article></section></>}{<section style={{marginTop:32}}><h2>Recent Activity</h2><div style={{borderTop:"1px solid #ddd"}}>{activity.map(item=><div key={`${item.kind}-${item.id}`} style={{display:"grid",gridTemplateColumns:"120px 1fr 160px 120px",gap:16,padding:"14px 0",borderBottom:"1px solid #eee"}}><strong>{item.kind}</strong><span>{item.status}</span><span>{money(item.amount,item.currency)}</span><time>{new Date(item.occurredAt).toLocaleString()}</time></div>)}{activity.length===0&&<p style={{opacity:.6}}>No financial activity yet.</p>}</div></section>}</main>;
}
