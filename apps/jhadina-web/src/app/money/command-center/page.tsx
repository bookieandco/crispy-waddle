'use client'

import { useMemo, useState } from "react"
import { createApprovalAction, prioritizeFinancialAttention, type FinancialAttention } from "@/lib/money/financialAttention"

const seed: FinancialAttention[] = [
  { id:"demo-card", type:"CREDIT_CARD", title:"Credit card payment", amount:0, currency:"USD", severity:"URGENT", action:"Review payment", requiresApproval:true },
  { id:"demo-bill", type:"BILL", title:"Upcoming bills", amount:0, currency:"USD", severity:"SOON", action:"Review bills", requiresApproval:true },
  { id:"demo-sub", type:"SUBSCRIPTION", title:"Recurring subscriptions", severity:"REVIEW", action:"Review subscriptions", requiresApproval:true },
]

export default function MoneyCommandCenter() {
  const [items,setItems]=useState(seed)
  const [message,setMessage]=useState("")
  const prioritized=useMemo(()=>prioritizeFinancialAttention(items),[items])
  function prepare(item:FinancialAttention){
    const action=createApprovalAction(item)
    setMessage(`Prepared: ${action.action}. Pending your approval; no money moved.`)
  }
  return <main style={{minHeight:"100vh",background:"linear-gradient(180deg,#f6f1e9,#edf2ed)",color:"#29332e",padding:"30px 18px 100px",fontFamily:'ui-rounded,"Avenir Next",system-ui,sans-serif'}}><div style={{maxWidth:920,margin:"0 auto"}}><div style={eyebrow}>Money Core</div><h1 style={h1}>Financial Command Center</h1><p style={sub}>One place to see what needs attention across credit, bills, subscriptions and cash actions.</p><section style={hero}><span>Available cash</span><strong>$0.00</strong><small>Connected account balances will appear here once the Money Core account API is wired.</small></section><section style={card}><div style={sectionHead}><h2 style={h2}>Needs attention</h2><span>{prioritized.length} items</span></div>{prioritized.map(item=><article key={item.id} style={row}><div><div style={badge(item.severity)}>{item.severity}</div><h3 style={{margin:"7px 0 3px",fontSize:17}}>{item.title}</h3><p style={{margin:0,color:"#718078",fontSize:13}}>{item.amount ? new Intl.NumberFormat("en-US",{style:"currency",currency:item.currency||"USD"}).format(item.amount):"Amount will appear from connected financial data."}</p></div><button onClick={()=>prepare(item)} style={button}>One-click review</button></article>)}{message&&<div role="status" style={notice}>{message}</div>}</section><section style={grid}>{["Credit cards","Bills","Subscriptions","Credit","Transfers"].map(x=><div key={x} style={tile}><strong>{x}</strong><span>Connect data to populate</span></div>)}</section></div></main>
}
const eyebrow={fontSize:10,letterSpacing:".2em",textTransform:"uppercase" as const,color:"#77847c"};const h1={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:"clamp(38px,9vw,62px)",letterSpacing:"-.045em",margin:"12px 0 8px"};const h2={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:27,margin:0};const sub={color:"#718078",lineHeight:1.6,maxWidth:680};const hero={marginTop:25,padding:22,borderRadius:28,background:"#34443c",color:"#f8f6f1",display:"grid",gap:5};const card={marginTop:14,padding:22,borderRadius:28,background:"rgba(255,255,255,.72)",border:"1px solid #dce2dd"};const sectionHead={display:"flex",justifyContent:"space-between",alignItems:"center",color:"#657169"};const row={display:"flex",justifyContent:"space-between",gap:15,alignItems:"center",padding:"16px 0",borderBottom:"1px solid #e5e9e5"};const button={border:0,borderRadius:999,padding:"10px 14px",background:"#34443c",color:"#f8f6f1",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" as const};const notice={marginTop:14,padding:13,borderRadius:16,background:"#e8eee8",color:"#4e6255"};const grid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:10,marginTop:14};const tile={padding:18,borderRadius:22,background:"rgba(255,255,255,.7)",border:"1px solid #dce2dd",display:"grid",gap:5};function badge(s:FinancialAttention["severity"]){return {fontSize:9,letterSpacing:".12em",fontWeight:800,color:s==="URGENT"?"#8a3e38":"#657169"}}
