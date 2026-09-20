"use client"

import Link from "next/link"

export default function MoneyLiveOperationsPage(){
 return <main style={shell}><div style={wrap}>
  <div style={eyebrow}>Money Core · Manual Canary</div>
  <h1 style={h1}>Live Operations</h1>
  <p style={sub}>The production trading surface is deliberately split into review, approval, execution, and reconciliation. This page never turns a recommendation into an order by itself.</p>
  <section style={card}><h2 style={h2}>No active canary session</h2><p style={muted}>A trade appears here only after Money Core has a current execution plan, live preflight, broker-account entitlement, portfolio reconciliation, shadow readiness, and canary risk reservation.</p></section>
  <section style={grid}>
   <article style={card}><strong>1 · Review</strong><p style={muted}>Exact provider, account, instrument, side, notional, limit, evidence, risk limits, and reconciliation state.</p></article>
   <article style={card}><strong>2 · Approve</strong><p style={muted}>Approval is a separate explicit human action. It creates no order and cannot execute.</p></article>
   <article style={card}><strong>3 · Execute</strong><p style={muted}>Execution requires a second explicit human action plus a valid single-use permit and canary reservation.</p></article>
   <article style={card}><strong>4 · Reconcile</strong><p style={muted}>ACK, fills, fees, settlement, or UNKNOWN are reconciled back into canonical Money state before another ambiguous action is allowed.</p></article>
  </section>
  <section style={danger}><strong>Emergency controls</strong><span>Kill switch and UNKNOWN execution blocks remain server-side authority boundaries. Client UI cannot override them.</span></section>
  <Link href="/money/command-center" style={link}>Back to Financial Command Center</Link>
 </div></main>
}
const shell={minHeight:"100vh",background:"linear-gradient(180deg,#f6f1e9,#edf2ed)",color:"#29332e",padding:"30px 18px 100px",fontFamily:'ui-rounded,"Avenir Next",system-ui,sans-serif'}
const wrap={maxWidth:920,margin:"0 auto"}
const eyebrow={fontSize:10,letterSpacing:".2em",textTransform:"uppercase" as const,color:"#77847c"}
const h1={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:"clamp(38px,9vw,62px)",letterSpacing:"-.045em",margin:"12px 0 8px"}
const h2={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:27,margin:0}
const sub={color:"#718078",lineHeight:1.6,maxWidth:700}
const grid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:14,marginTop:20}
const card={padding:22,borderRadius:24,background:"rgba(255,255,255,.72)",border:"1px solid #dce2dd"}
const muted={color:"#718078",fontSize:13,lineHeight:1.6}
const danger={marginTop:14,padding:18,borderRadius:22,background:"#34443c",color:"#f8f6f1",display:"grid",gap:6,fontSize:13}
const link={display:"inline-block",marginTop:22,color:"#34443c"}
