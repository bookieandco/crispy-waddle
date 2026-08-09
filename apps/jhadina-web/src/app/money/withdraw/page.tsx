'use client'

import { useState } from "react"
import { requestWithdrawal } from "@/lib/music/moneyCoreWithdrawal"

export default function WithdrawPage() {
  const [amount,setAmount]=useState("")
  const [destination,setDestination]=useState("")
  const [status,setStatus]=useState("")
  const available=0
  function submit(){
    try {
      const request=requestWithdrawal({accountId:"money-core-main",currency:"USD",available,reserved:0},Number(amount),destination)
      setStatus(`Withdrawal ${request.id} created and is pending approval.`)
    } catch(e){setStatus(e instanceof Error?e.message:"Could not create withdrawal")}
  }
  return <main style={{minHeight:"100vh",background:"linear-gradient(180deg,#f6f1e9,#edf2ed)",color:"#29332e",padding:"32px 18px 100px",fontFamily:'ui-rounded,"Avenir Next",system-ui,sans-serif'}}><div style={{maxWidth:620,margin:"0 auto"}}><div style={eyebrow}>Money Core</div><h1 style={h1}>Withdraw or transfer</h1><p style={sub}>All confirmed Money Core income uses the same withdrawal boundary, regardless of where the money originally came from.</p><section style={card}><div style={balance}><span>Available</span><strong>$0.00</strong></div><label style={label}>Amount<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" style={input}/></label><label style={label}>Destination account<input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Connected owned account" style={input}/></label><button onClick={submit} style={primary}>Request withdrawal</button>{status&&<div role="status" style={notice}>{status}</div>}<div style={rule}><strong>Approval boundary</strong><br/>A request never moves money by itself. It must be approved before an authorized payment/banking connector can execute it.</div></section></div></main>
}
const eyebrow={fontSize:10,letterSpacing:".2em",textTransform:"uppercase" as const,color:"#77847c"};const h1={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:"clamp(38px,9vw,62px)",letterSpacing:"-.045em",margin:"12px 0 8px"};const sub={color:"#718078",lineHeight:1.6};const card={marginTop:25,padding:22,borderRadius:28,background:"rgba(255,255,255,.7)",border:"1px solid #dce2dd",boxShadow:"0 16px 45px rgba(67,76,69,.08)"};const balance={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px",borderRadius:20,background:"#34443c",color:"#f8f6f1",marginBottom:22};const label={display:"block",fontSize:12,color:"#657169",marginTop:14};const input={display:"block",width:"100%",boxSizing:"border-box" as const,padding:13,borderRadius:16,border:"1px solid #d5ddd7",background:"rgba(255,255,255,.8)",font:"inherit",marginTop:6};const primary={marginTop:20,border:0,borderRadius:999,padding:"13px 19px",background:"#34443c",color:"#f8f6f1",fontWeight:700,cursor:"pointer"};const notice={marginTop:13,padding:13,borderRadius:16,background:"#e8eee8",color:"#4e6255"};const rule={marginTop:18,padding:14,borderRadius:16,background:"#f1eee7",color:"#657169",fontSize:12,lineHeight:1.5};