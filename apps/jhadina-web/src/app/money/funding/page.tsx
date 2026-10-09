"use client"

import Link from "next/link"
import { FormEvent,useEffect,useMemo,useState } from "react"
import type { MoneyAccount } from "@jhadina/money-core"

type Kind="DEPOSIT"|"WITHDRAWAL"|"TRANSFER"
type AccountsResponse={success:true;data:{accounts:MoneyAccount[]}}|{success:false;error:string}
type WorkspaceResponse={success:true;data:{coffer:null|{cofferId:string;currency:string}}}|{success:false;error:string}
type Commissioning={certificateId:string;evidenceClass:"REAL_LIVE"|"SYNTHETIC_TEST";status:"REJECTED"|"SOFTWARE_ONLY"|"CONTROLLED_CANARY_CERTIFIED"|"LIVE_CERTIFIED";controlledCanaryCertified:boolean;liveCertified:boolean;recordedAt:string;reasonCodes:string[]}
type Rail={railId:string;provider:string;environment:string;admission:string;commissioningCertificateId:string|null;commissioning:Commissioning|null;maxMovementMinor:string;maxDailyMovementMinor:string;allowedKinds:string[];allowedCurrencies:string[];executable:boolean;evidenceIds:string[]}
type Readiness={rails:Rail[];pendingApprovalCount:number;approvedNotExecutedCount:number;unresolvedAttemptCount:number;unsettledAttemptCount:number;canExecuteAnyLiveMovement:boolean;blockers:string[];canMoveMoney:false}
type ReadinessResponse={success:true;data:Readiness}|{success:false;error:string}
type ProposalData={proposal:{movementId:string;kind:Kind;amountMinor:string;currency:string;sourceId:string;destinationId:string;state:string};approval:{receiptId:string;status:string;expiresAt:string};feedPublished:boolean}
type ProposalResponse={success:true;data:ProposalData}|{success:false;error:string}
type Endpoint={id:string;label:string;currency:string;kind:"BANK"|"COFFER"}

export default function MoneyFundingPage(){
 const [kind,setKind]=useState<Kind>("DEPOSIT")
 const [accounts,setAccounts]=useState<MoneyAccount[]>([])
 const [coffer,setCoffer]=useState<{cofferId:string;currency:string}|null>(null)
 const [readiness,setReadiness]=useState<Readiness|null>(null)
 const [amount,setAmount]=useState("")
 const [sourceId,setSourceId]=useState("")
 const [destinationId,setDestinationId]=useState("")
 const [loading,setLoading]=useState(true)
 const [submitting,setSubmitting]=useState(false)
 const [error,setError]=useState("")
 const [receipt,setReceipt]=useState<ProposalData|null>(null)

 async function loadReadiness(){
  try{
   const r=await fetch("/api/money/funding-readiness",{credentials:"same-origin",cache:"no-store"})
   const body=await r.json() as ReadinessResponse
   if(r.ok&&body.success)setReadiness(body.data)
  }catch{}
 }

 useEffect(()=>{
  const requested=new URLSearchParams(window.location.search).get("action")
  if(requested==="withdrawal")setKind("WITHDRAWAL")
  else if(requested==="transfer")setKind("TRANSFER")
  else setKind("DEPOSIT")
  let active=true
  void Promise.all([
   fetch("/api/money/accounts",{credentials:"same-origin",cache:"no-store"}).then(r=>r.json() as Promise<AccountsResponse>),
   fetch("/api/money/workspace",{credentials:"same-origin",cache:"no-store"}).then(r=>r.json() as Promise<WorkspaceResponse>),
   fetch("/api/money/funding-readiness",{credentials:"same-origin",cache:"no-store"}).then(r=>r.json() as Promise<ReadinessResponse>),
  ]).then(([a,w,fr])=>{
   if(!active)return
   if(a.success)setAccounts(a.data.accounts);else setError(a.error)
   if(w.success)setCoffer(w.data.coffer);else setError(x=>x||w.error)
   if(fr.success)setReadiness(fr.data);else setError(x=>x||fr.error)
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load funding desk")}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[])

 const endpoints=useMemo<Endpoint[]>(()=>{
  const xs:Endpoint[]=[]
  if(coffer)xs.push({id:"coffer:"+coffer.cofferId,label:"Purse",currency:coffer.currency,kind:"COFFER"})
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
   await loadReadiness()
  }catch(e){setError(e instanceof Error?e.message:"Could not create proposal")}finally{setSubmitting(false)}
 }

 return <main style={shell}><div style={wrap}>
  <div style={top}><div><div style={eyebrow}>Money Core · Funding</div><h1 style={h1}>Funding Desk</h1></div><div style={topActions}><Link href="/approvals" style={linkButton}>Approvals</Link><Link href="/money/command-center" style={linkButton}>Back to Money</Link></div></div>
  <p style={sub}>Prepare deposits, cash-outs, and transfers between verified owner endpoints. A proposal creates a fingerprint-bound owner approval receipt. Approval still does not call a bank, broker, or wallet provider.</p>

  <section style={readinessCard}>
   <div style={sectionHead}><div><div style={eyebrow}>Execution readiness</div><h2 style={h2}>Live funding gates</h2></div><span style={readiness?.canExecuteAnyLiveMovement?goodPill:warnPill}>{readiness?.canExecuteAnyLiveMovement?"RAIL READY":"FAIL CLOSED"}</span></div>
   <div style={metricGrid}>
    <Metric label="Pending approval" value={String(readiness?.pendingApprovalCount??0)}/>
    <Metric label="Approved · no permit" value={String(readiness?.approvedNotExecutedCount??0)}/>
    <Metric label="Unresolved provider" value={String(readiness?.unresolvedAttemptCount??0)}/>
    <Metric label="In flight" value={String(readiness?.unsettledAttemptCount??0)}/>
   </div>
   {(readiness?.blockers.length??0)>0?<div style={blockers}>{readiness!.blockers.map(x=><span key={x} style={blocker}>{friendlyBlocker(x)}</span>)}</div>:<p style={fine}>No runtime blocker is currently recorded. Each movement still requires its exact approval and execution permit.</p>}
   <div style={railGrid}>{(readiness?.rails??[]).map(rail=><article style={railCard} key={rail.railId}><div style={strategyTitle}><strong>{rail.provider}</strong><span style={rail.executable?goodPill:warnPill}>{rail.admission}</span></div><p style={fine}>{rail.environment} · {rail.allowedKinds.join(" / ")||"no allowed movement kinds"}</p><p style={fine}>Certification: {rail.commissioning?.status??"NOT RECORDED"}{rail.commissioning?" · "+rail.commissioning.evidenceClass:""}</p><p style={fine}>Per movement {fromMinor(rail.maxMovementMinor)} · daily {fromMinor(rail.maxDailyMovementMinor)} {rail.allowedCurrencies.join(", ")}</p>{rail.commissioning?.reasonCodes.length?<p style={fine}>Certificate blockers: {rail.commissioning.reasonCodes.join(" · ")}</p>:null}</article>)}</div>
  </section>

  <div style={tabs}>
   {(["DEPOSIT","WITHDRAWAL","TRANSFER"] as Kind[]).map(x=><button key={x} type="button" style={x===kind?tabActive:tab} onClick={()=>setKind(x)}>{x==="DEPOSIT"?"Add funds":x==="WITHDRAWAL"?"Cash out":"Transfer"}</button>)}
  </div>

  <section style={grid}>
   <form onSubmit={submit} style={card}>
    <div style={eyebrow}>{kind}</div><h2 style={h2}>{kind==="DEPOSIT"?"Bank → Purse":kind==="WITHDRAWAL"?"Purse → Bank":"Verified endpoint → endpoint"}</h2>
    {!coffer&&!loading&&<div style={warning}>The Purse is not commissioned yet. Funding proposals stay unavailable until an owner Purse exists.</div>}
    <label style={label}>Amount
     <div style={moneyInput}><span>{currency}</span><input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" style={input}/></div>
    </label>
    <label style={label}>From<select value={sourceId} onChange={e=>setSourceId(e.target.value)} style={select}><option value="">Choose source</option>{endpoints.map(x=><option key={x.id} value={x.id}>{x.label} · {x.currency}</option>)}</select></label>
    <label style={label}>To<select value={destinationId} onChange={e=>setDestinationId(e.target.value)} style={select}><option value="">Choose destination</option>{endpoints.map(x=><option key={x.id} value={x.id}>{x.label} · {x.currency}</option>)}</select></label>
    {error&&<div role="alert" style={alert}>{friendly(error)}</div>}
    <button type="submit" style={primary} disabled={loading||submitting||!coffer||!sourceId||!destinationId}>{submitting?"Preparing…":"Prepare approval proposal"}</button>
    <small style={fine}>No provider call is made here. Owner approval, Money execution permit, live rail capability, provider acknowledgement and reconciliation are separate gates.</small>
    {receipt&&<div style={receiptLight}><strong>Approval receipt created</strong><span>{receipt.approval.receiptId}</span><span>{receipt.approval.status} · expires {new Date(receipt.approval.expiresAt).toLocaleString()}</span><Link href="/approvals" style={lightLink}>Review in Approval Center →</Link></div>}
   </form>

   <aside style={darkCard}>
    <div style={darkEyebrow}>Accountant controls</div><h2 style={darkH2}>Before money moves</h2>
    <ol style={list}>
     <li>Confirm source and destination belong to you.</li>
     <li>Bind an expiring owner approval to the exact movement fingerprint.</li>
     <li>Issue a separate single-use Money execution permit after Action Core accepts approval.</li>
     <li>Require a commissioned LIVE funding rail with per-movement and daily caps.</li>
     <li>Block duplicate submission while any provider result is unresolved.</li>
     <li>Record provider acknowledgement/settlement as evidence, never authority.</li>
     <li>Reconcile source, destination and fees after completion.</li>
    </ol>
    {receipt&&<div style={receiptStyle}><strong>Proposal prepared</strong><span>{receipt.proposal.movementId}</span><span>{receipt.proposal.state}</span><span>No money moved.</span></div>}
   </aside>
  </section>
 </div></main>
}

function Metric({label,value}:{label:string;value:string}){return <div style={metric}><strong style={{fontSize:22}}>{value}</strong><span style={fine}>{label}</span></div>}
function toMinor(value:string){const s=value.trim();if(!/^\d+(\.\d{1,2})?$/.test(s))throw new Error("Enter a positive amount with no more than two decimal places.");const [whole,dec=""]=s.split(".");const minor=BigInt(whole)*100n+BigInt((dec+"00").slice(0,2));if(minor<=0n)throw new Error("Amount must be greater than zero.");return minor.toString()}
function fromMinor(value:string){const n=BigInt(value||"0");return "$"+(Number(n)/100).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
function friendly(x:string){if(x.includes("NOT_COMMISSIONED"))return"The Purse must be commissioned before funding proposals can be created.";if(x.includes("CURRENCY_MISMATCH"))return"Source and destination currencies must match.";if(x.includes("APPROVAL_CREATE"))return"Could not create a durable approval receipt, so the movement was rejected.";return x}
function friendlyBlocker(x:string){return x==="FUNDING_PROVIDER_CERTIFICATION_REQUIRED"?"Funding provider certification not recorded":x==="REAL_FUNDING_PROVIDER_EVIDENCE_REQUIRED"?"Only synthetic/software funding evidence exists":x==="FUNDING_CERTIFICATE_BINDING_INVALID"?"Funding admission does not match its real certificate":x==="LIVE_FUNDING_RAIL_NOT_COMMISSIONED"?"No certified LIVE funding rail commissioned":x==="UNRESOLVED_PROVIDER_ATTEMPT"?"Provider result unresolved":x==="MOVEMENT_STILL_IN_FLIGHT"?"A movement is still in flight":x==="APPROVED_MOVEMENT_NEEDS_EXECUTION_PERMIT"?"Approved movement still needs a Money permit":x}

const shell={minHeight:"100vh",background:"linear-gradient(180deg,#f6f1e9,#edf2ed)",color:"#29332e",padding:"30px 18px 100px",fontFamily:'ui-rounded,"Avenir Next",system-ui,sans-serif'}
const wrap={maxWidth:1040,margin:"0 auto"}
const top={display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-start",flexWrap:"wrap" as const}
const topActions={display:"flex",gap:8,flexWrap:"wrap" as const}
const eyebrow={fontSize:10,letterSpacing:".2em",textTransform:"uppercase" as const,color:"#77847c"}
const h1={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:"clamp(42px,9vw,68px)",letterSpacing:"-.05em",margin:"8px 0 0"}
const h2={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:28,margin:"7px 0 0"}
const sub={color:"#718078",lineHeight:1.6,maxWidth:800}
const linkButton={textDecoration:"none",border:"1px solid #ccd5cf",borderRadius:999,padding:"9px 13px",color:"#34443c",fontSize:13,background:"rgba(255,255,255,.55)"}
const readinessCard={padding:20,borderRadius:26,background:"rgba(255,255,255,.7)",border:"1px solid #dce2dd",marginTop:24}
const sectionHead={display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",flexWrap:"wrap" as const}
const metricGrid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:10,marginTop:16}
const metric={display:"grid",gap:4,padding:14,borderRadius:16,background:"#f5f5f0",border:"1px solid #e0e4df"}
const railGrid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:10,marginTop:14}
const railCard={padding:14,borderRadius:16,background:"#fff",border:"1px solid #e0e4df"}
const strategyTitle={display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}
const goodPill={fontSize:10,padding:"5px 8px",borderRadius:999,background:"#e6efe8",color:"#3f6350"}
const warnPill={fontSize:10,padding:"5px 8px",borderRadius:999,background:"#efe4ca",color:"#6f5a25"}
const blockers={display:"flex",gap:7,flexWrap:"wrap" as const,marginTop:14}
const blocker={fontSize:11,padding:"7px 9px",borderRadius:999,background:"#f3e4e1",color:"#743b36"}
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
const receiptLight={display:"grid",gap:6,padding:13,borderRadius:15,background:"#eef1ed",fontSize:11,color:"#526158"}
const lightLink={color:"#34443c",fontWeight:700}
