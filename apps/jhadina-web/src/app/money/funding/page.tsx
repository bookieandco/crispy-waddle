"use client"

import Link from "next/link"
import { FormEvent,useEffect,useMemo,useState } from "react"
import type { MoneyAccount } from "@jhadina/money-core"

type Kind="DEPOSIT"|"WITHDRAWAL"|"TRANSFER"
type AccountsResponse={success:true;data:{accounts:MoneyAccount[]}}|{success:false;error:string}
type WorkspaceResponse={success:true;data:{coffer:null|{cofferId:string;currency:string}}}|{success:false;error:string}
type ProposalData={proposal:{movementId:string;kind:Kind;amountMinor:string;currency:string;sourceId:string;destinationId:string;state:string}}
type ProposalResponse={success:true;data:ProposalData}|{success:false;error:string}

type Endpoint={id:string;label:string;currency:string;kind:"BANK"|"COFFER"}

export default function MoneyFundingPage(){
 const [kind,setKind]=useState<Kind>("DEPOSIT")
 const [accounts,setAccounts]=useState<MoneyAccount[]>([])
 const [coffer,setCoffer]=useState<{cofferId:string;currency:string}|null>(null)
 const [amount,setAmount]=useState("")
 const [sourceId,setSourceId]=useState("")
 const [destinationId,setDestinationId]=useState("")
 const [loading,setLoading]=useState(true)
 const [submitting,setSubmitting]=useState(false)
 const [error,setError]=useState("")
 const [receipt,setReceipt]=useState<ProposalData|null>(null)

 useEffect(()=>{
  const requested=new URLSearchParams(window.location.search).get("action")
  if(requested==="withdrawal")setKind("WITHDRAWAL")
  else if(requested==="transfer")setKind("TRANSFER")
  else setKind("DEPOSIT")
  let active=true
  void Promise.all([
   fetch("/api/money/accounts",{credentials:"same-origin",cache:"no-store"}).then(r=>r.json() as Promise<AccountsResponse>),
   fetch("/api/money/workspace",{credentials:"same-origin",cache:"no-store"}).then(r=>r.json() as Promise<WorkspaceResponse>),
  ]).then(([a,w])=>{
   if(!active)return
   if(a.success)setAccounts(a.data.accounts);else setError(a.error)
   if(w.success)setCoffer(w.data.coffer);else setError(x=>x||w.error)
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load funding desk")}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[])

 const endpoints=useMemo<Endpoint[]>(()=>{
  const xs:Endpoint[]=[]
  if(coffer)xs.push({id:"coffer:"+coffer.cofferId,label:"Coffer",currency:coffer.currency,kind:"COFFER"})
  for(const a of accounts)if(a.externalId&&a.currency&&a.currency!=="UNKNOWN")xs.push({id:"bank:"+a.externalId,label:(a.maskedName??a.type)+" · "+a.provider,currency:a.currency,kind:"BANK"})
  return xs
 },[accounts,coffer])

 useEffect(()=>{
  const bank=endpoints.filter(x=>x.kind==="BANK")
  const c=endpoints.find(x=>x.kind==="COFFER")
  if(kind==="DEPOSIT"){setSourceId(bank[0]?.id??"");setDestinationId(c?.id??"")}
  else if(kind==="WITHDRAWAL"){setSourceId(c?.id??"");setDestinationId(bank[0]?.id??"")}
  else{setSourceId(bank[0]?.id??c?.id??"");setDestinationId(bank[1]?.id??c?.id??"")}
  setReceipt(null);setError("")
 },[kind,endpoints])

 const source=endpoints.find(x=>x.id===sourceId),destination=endpoints.find(x=>x.id===destinationId)
 const currency=source?.currency??destination?.currency??coffer?.currency??"USD"

 async function submit(e:FormEvent){
  e.preventDefault();setError("");setReceipt(null)
  let amountMinor:string
  try{amountMinor=toMinor(amount)}catch(err){setError(err instanceof Error?err.message:"Invalid amount");return}
  setSubmitting(true)
  try{
   const r=await fetch("/api/money/movement-proposals",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({kind,amountMinor,currency,sourceId,destinationId})})
   const body=await r.json() as ProposalResponse
   if(!r.ok||!body.success)throw new Error(body.success?"Could not create proposal":body.error)
   setReceipt(body.data)
  }catch(e){setError(e instanceof Error?e.message:"Could not create proposal")}finally{setSubmitting(false)}
 }

 return <main style={shell}><div style={wrap}>
  <div style={top}><div><div style={eyebrow}>Money Core · Funding</div><h1 style={h1}>Funding Desk</h1></div><Link href="/money/command-center" style={linkButton}>Back to Money</Link></div>
  <p style={sub}>Prepare deposits, cash-outs, and transfers between verified owner endpoints. This screen creates an approval proposal; it does not call a bank, broker, or wallet provider.</p>

  <div style={tabs}>
   {(["DEPOSIT","WITHDRAWAL","TRANSFER"] as Kind[]).map(x=><button key={x} type="button" style={x===kind?tabActive:tab} onClick={()=>setKind(x)}>{x==="DEPOSIT"?"Add funds":x==="WITHDRAWAL"?"Cash out":"Transfer"}</button>)}
  </div>

  <section style={grid}>
   <form onSubmit={submit} style={card}>
    <div style={eyebrow}>{kind}</div><h2 style={h2}>{kind==="DEPOSIT"?"Bank → Coffer":kind==="WITHDRAWAL"?"Coffer → Bank":"Verified endpoint → endpoint"}</h2>
    {!coffer&&!loading&&<div style={warning}>The Coffer is not commissioned yet. Funding proposals stay unavailable until an owner Coffer exists.</div>}
    <label style={label}>Amount
     <div style={moneyInput}><span>{currency}</span><input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" style={input}/></div>
    </label>
    <label style={label}>From<select value={sourceId} onChange={e=>setSourceId(e.target.value)} style={select}><option value="">Choose source</option>{endpoints.map(x=><option key={x.id} value={x.id}>{x.label} · {x.currency}</option>)}</select></label>
    <label style={label}>To<select value={destinationId} onChange={e=>setDestinationId(e.target.value)} style={select}><option value="">Choose destination</option>{endpoints.map(x=><option key={x.id} value={x.id}>{x.label} · {x.currency}</option>)}</select></label>
    {error&&<div role="alert" style={alert}>{friendly(error)}</div>}
    <button type="submit" style={primary} disabled={loading||submitting||!coffer||!sourceId||!destinationId}>{submitting?"Preparing…":"Prepare approval proposal"}</button>
    <small style={fine}>No provider call is made here. Approval, execution permit, provider capability, and reconciliation remain separate gates.</small>
   </form>

   <aside style={darkCard}>
    <div style={darkEyebrow}>Accountant controls</div><h2 style={darkH2}>Before money moves</h2>
    <ol style={list}>
     <li>Confirm source and destination belong to you.</li>
     <li>Use exact currency and integer-minor-unit accounting.</li>
     <li>For profit sweeps, use realized and settled net profit only.</li>
     <li>Preserve planning reserve, retained profit, and Coffer survival floors.</li>
     <li>Create a balanced journal candidate.</li>
     <li>Require approval/permit before provider execution.</li>
     <li>Reconcile source, destination, and fees after completion.</li>
    </ol>
    {receipt&&<div style={receiptStyle}><strong>Proposal created</strong><span>{receipt.proposal.movementId}</span><span>{receipt.proposal.state}</span><Link href="/approvals" style={darkLink}>Open approvals →</Link></div>}
   </aside>
  </section>
 </div></main>
}

function toMinor(value:string){
 const s=value.trim()
 if(!/^\d+(\.\d{1,2})?$/.test(s))throw new Error("Enter a positive amount with no more than two decimal places.")
 const [whole,dec=""]=s.split(".")
 const minor=BigInt(whole)*100n+BigInt((dec+"00").slice(0,2))
 if(minor<=0n)throw new Error("Amount must be greater than zero.")
 return minor.toString()
}
function friendly(x:string){if(x.includes("NOT_COMMISSIONED"))return"The Coffer must be commissioned before funding proposals can be created.";if(x.includes("CURRENCY_MISMATCH"))return"Source and destination currencies must match.";return x}

const shell={minHeight:"100vh",background:"linear-gradient(180deg,#f6f1e9,#edf2ed)",color:"#29332e",padding:"30px 18px 100px",fontFamily:'ui-rounded,"Avenir Next",system-ui,sans-serif'}
const wrap={maxWidth:980,margin:"0 auto"}
const top={display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-start",flexWrap:"wrap" as const}
const eyebrow={fontSize:10,letterSpacing:".2em",textTransform:"uppercase" as const,color:"#77847c"}
const h1={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:"clamp(42px,9vw,68px)",letterSpacing:"-.05em",margin:"8px 0 0"}
const h2={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:28,margin:"7px 0 0"}
const sub={color:"#718078",lineHeight:1.6,maxWidth:760}
const linkButton={textDecoration:"none",border:"1px solid #ccd5cf",borderRadius:999,padding:"9px 13px",color:"#34443c",fontSize:13,background:"rgba(255,255,255,.55)"}
const tabs={display:"flex",gap:8,margin:"24px 0 14px",flexWrap:"wrap" as const}
const tab={border:"1px solid #ccd5cf",borderRadius:999,padding:"10px 14px",background:"rgba(255,255,255,.6)",color:"#56665d",cursor:"pointer"}
const tabActive={...tab,background:"#34443c",color:"#f8f6f1",border:"1px solid #34443c"}
const grid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14}
const card={padding:22,borderRadius:26,background:"rgba(255,255,255,.78)",border:"1px solid #dce2dd",display:"grid",gap:16}
const darkCard={padding:22,borderRadius:26,background:"#34443c",color:"#f8f6f1"}
const darkEyebrow={...eyebrow,color:"rgba(248,246,241,.58)"}
const darkH2={...h2,color:"#f8f6f1"}
const label={display:"grid",gap:7,fontSize:12,color:"#657169"}
const moneyInput={display:"flex",alignItems:"center",border:"1px solid #d6ddd8",borderRadius:16,background:"#fff",overflow:"hidden",paddingLeft:12}
const input={width:"100%",border:0,outline:"none",padding:"13px 12px",fontSize:18,background:"transparent",color:"#29332e"}
const select={border:"1px solid #d6ddd8",borderRadius:16,background:"#fff",padding:"13px 12px",fontSize:14,color:"#29332e"}
const primary={border:0,borderRadius:999,padding:"12px 15px",background:"#34443c",color:"#f8f6f1",fontWeight:700,cursor:"pointer"}
const fine={fontSize:11,color:"#7b867f",lineHeight:1.5}
const warning={padding:12,borderRadius:14,background:"#efe4ca",color:"#6f5a25",fontSize:12,lineHeight:1.5}
const alert={padding:12,borderRadius:14,background:"#f3e4e1",color:"#743b36",fontSize:12}
const list={paddingLeft:20,lineHeight:1.75,color:"rgba(248,246,241,.78)",fontSize:13}
const receiptStyle={display:"grid",gap:7,marginTop:20,padding:15,borderRadius:16,background:"rgba(255,255,255,.1)",fontSize:12}
const darkLink={color:"#f8f6f1"}
