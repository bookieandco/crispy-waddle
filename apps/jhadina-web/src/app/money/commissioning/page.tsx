"use client"

import Link from "next/link"
import { FormEvent,useEffect,useMemo,useState } from "react"

const LANES=["MEME","CRYPTO","SPORTS","STOCK","FOREX","PREDICTION","METALS"] as const
type Lane=typeof LANES[number]
type BudgetForm=Record<Lane,{allocation:string;hardCap:string}>
type Workspace={
 coffer:null|{cofferId:string;currency:string;principalCapitalMinor:string;hardStopFloorMinor:string;survivalFloorMinor:string;defensiveFloorMinor:string;maxDeployableBps:number;state:string}
 sweepPolicy:null|{thresholdMinor:string;retainMinor:string;planningReserveBps:number;enabled:boolean;verifiedOwnerDestinationId:string|null;standingMandateId:string|null}
 budgets:{lane:string;allocatedMinor:string;hardCapMinor:string;reservedMinor:string;spentMinor:string;state:string;currency:string}[]
 signerLeases:{leaseId:string;agentId:string;sessionId:string;expiresAt:string;state:string;perTransactionCapMinor:string;rolling24hCapMinor:string;maxTransactionCount:number;allowedAssets:string[];allowedDestinationAddresses:string[]}[]
 syncStates:{syncId:string;provider:string;providerItemId:string;state:string;includedAccountIds:string[];lastSuccessfulSyncAt:string|null;lastErrorCode:string|null}[]
 connectors:{connectorId:string;provider:string;lane:string;admission:string}[]
}
type WorkspaceResponse={success:true;data:Workspace}|{success:false;error:string}
type SaveData={cofferId:string;state:string;totalAllocatedMinor:string;unallocatedMinor:string;fundingRequired:boolean;canFund:false;canTrade:false}
type SaveResponse={success:true;data:SaveData}|{success:false;error:string}

const emptyBudgets=()=>Object.fromEntries(LANES.map(l=>[l,{allocation:"",hardCap:""}])) as BudgetForm

export default function MoneyCommissioningPage(){
 const [workspace,setWorkspace]=useState<Workspace|null>(null)
 const [currency,setCurrency]=useState("USD")
 const [principal,setPrincipal]=useState("")
 const [hardStop,setHardStop]=useState("")
 const [survival,setSurvival]=useState("")
 const [defensive,setDefensive]=useState("")
 const [maxDeployable,setMaxDeployable]=useState("50")
 const [sweepThreshold,setSweepThreshold]=useState("")
 const [retain,setRetain]=useState("")
 const [reservePercent,setReservePercent]=useState("25")
 const [sweepEnabled,setSweepEnabled]=useState(false)
 const [budgets,setBudgets]=useState<BudgetForm>(emptyBudgets)
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState("")
 const [saved,setSaved]=useState<SaveData|null>(null)

 useEffect(()=>{
  let active=true
  void fetch("/api/money/workspace",{credentials:"same-origin",cache:"no-store"})
   .then(async r=>({r,body:await r.json() as WorkspaceResponse}))
   .then(({r,body})=>{
    if(!active)return
    if(!r.ok||!body.success)throw new Error(body.success?"Could not load Money workspace":body.error)
    const w=body.data;setWorkspace(w)
    if(w.coffer){
     setCurrency(w.coffer.currency)
     setPrincipal(fromMinor(w.coffer.principalCapitalMinor))
     setHardStop(fromMinor(w.coffer.hardStopFloorMinor))
     setSurvival(fromMinor(w.coffer.survivalFloorMinor))
     setDefensive(fromMinor(w.coffer.defensiveFloorMinor))
     setMaxDeployable(String(w.coffer.maxDeployableBps/100))
    }
    if(w.sweepPolicy){
     setSweepThreshold(fromMinor(w.sweepPolicy.thresholdMinor))
     setRetain(fromMinor(w.sweepPolicy.retainMinor))
     setReservePercent(String(w.sweepPolicy.planningReserveBps/100))
     setSweepEnabled(w.sweepPolicy.enabled)
    }
    const next=emptyBudgets()
    for(const b of w.budgets){
     if(LANES.includes(b.lane as Lane))next[b.lane as Lane]={allocation:fromMinor(b.allocatedMinor),hardCap:fromMinor(b.hardCapMinor)}
    }
    setBudgets(next)
   }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load commissioning")})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[])

 const totalAllocated=useMemo(()=>LANES.reduce((n,l)=>n+safeNumber(budgets[l].allocation),0),[budgets])
 const principalNumber=safeNumber(principal)
 const unallocated=Math.max(0,principalNumber-totalAllocated)

 async function save(e:FormEvent){
  e.preventDefault();setError("");setSaved(null);setSaving(true)
  try{
   const payload={
    currency,
    principalCapitalMinor:toMinor(principal),
    hardStopFloorMinor:toMinor(hardStop),
    survivalFloorMinor:toMinor(survival),
    defensiveFloorMinor:toMinor(defensive),
    maxDeployableBps:percentToBps(maxDeployable),
    profitSweepThresholdMinor:toMinor(sweepThreshold),
    profitRetainMinor:toMinor(retain),
    planningReserveBps:percentToBps(reservePercent),
    profitSweepEnabled:sweepEnabled,
    strategies:LANES.map(l=>({lane:l,allocatedMinor:toMinor(budgets[l].allocation||"0"),hardCapMinor:toMinor(budgets[l].hardCap||"0")})),
   }
   const r=await fetch("/api/money/commissioning",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify(payload)})
   const body=await r.json() as SaveResponse
   if(!r.ok||!body.success)throw new Error(body.success?"Could not save commissioning":body.error)
   setSaved(body.data)
  }catch(e){setError(friendly(e instanceof Error?e.message:"Could not save commissioning"))}finally{setSaving(false)}
 }

 return <main style={shell}><div style={wrap}>
  <div style={top}><div><div style={eyebrow}>Money Core · Commissioning</div><h1 style={h1}>Owner Control Center</h1></div><div style={topActions}><Link href="/money/command-center" style={linkButton}>Money home</Link><Link href="/money/live-operations" style={linkButton}>Live operations</Link></div></div>
  <p style={sub}>Define how much capital Money Core is allowed to manage and how each strategy is boxed in. Configuration never deposits cash, authorizes a trade, or creates a signer.</p>

  {error&&<div role="alert" style={alert}>{error}</div>}
  {saved&&<div style={success}><strong>Policy saved.</strong><span>Coffer state: {saved.state}. {saved.fundingRequired?"Real funding and reconciliation are still required before strategies can activate.":"Existing funded state was preserved."}</span></div>}

  <form onSubmit={save}>
   <section style={section}>
    <div style={sectionHead}><div><div style={eyebrow}>Coffer</div><h2 style={h2}>Capital & survival</h2></div><span style={pill}>{workspace?.coffer?.state??"NOT CONFIGURED"}</span></div>
    <div style={cardGrid}>
     <MoneyInput label="Principal capital target" value={principal} setValue={setPrincipal} currency={currency}/>
     <MoneyInput label="Defensive floor" value={defensive} setValue={setDefensive} currency={currency}/>
     <MoneyInput label="Survival floor" value={survival} setValue={setSurvival} currency={currency}/>
     <MoneyInput label="Hard-stop floor" value={hardStop} setValue={setHardStop} currency={currency}/>
     <PercentInput label="Max deployable above defensive floor" value={maxDeployable} setValue={setMaxDeployable}/>
     <label style={label}>Currency<select value={currency} onChange={e=>setCurrency(e.target.value)} style={input}><option>USD</option></select></label>
    </div>
    <p style={fine}>A newly configured Coffer remains <strong>RECAPITALIZATION_REQUIRED</strong>. Typed values are policy targets—not evidence that cash exists.</p>
   </section>

   <section style={section}>
    <div style={sectionHead}><div><div style={eyebrow}>Accountant</div><h2 style={h2}>Profit sweep policy</h2></div><label style={toggle}><input type="checkbox" checked={sweepEnabled} onChange={e=>setSweepEnabled(e.target.checked)}/> Enable threshold</label></div>
    <div style={cardGrid}>
     <MoneyInput label="Sweep after realized profit reaches" value={sweepThreshold} setValue={setSweepThreshold} currency={currency}/>
     <MoneyInput label="Retain profit inside Coffer" value={retain} setValue={setRetain} currency={currency}/>
     <PercentInput label="Planning reserve" value={reservePercent} setValue={setReservePercent}/>
     <StatusCard label="Cash-out destination" value={workspace?.sweepPolicy?.verifiedOwnerDestinationId?"Verified":"Not commissioned"}/>
     <StatusCard label="Standing mandate" value={workspace?.sweepPolicy?.standingMandateId?"Present":"Not commissioned"}/>
    </div>
    <p style={fine}>The threshold can be configured now, but a real sweep remains blocked until an actual transfer-capable owner destination and mandate are commissioned.</p>
   </section>

   <section style={section}>
    <div style={sectionHead}><div><div style={eyebrow}>Strategy envelopes</div><h2 style={h2}>No-overdraft budgets</h2></div><div style={summary}><span>Allocated {money(totalAllocated,currency)}</span><span>Unallocated {money(unallocated,currency)}</span></div></div>
    <div style={strategyGrid}>
     {LANES.map(l=><article style={card} key={l}><div style={strategyTitle}><strong>{labelLane(l)}</strong><span style={pill}>{workspace?.budgets.find(b=>b.lane===l)?.state??"NOT SET"}</span></div>
      <MoneyInput label="Allocation" value={budgets[l].allocation} setValue={v=>setBudgets(prev=>({...prev,[l]:{...prev[l],allocation:v}}))} currency={currency}/>
      <MoneyInput label="Hard cap" value={budgets[l].hardCap} setValue={v=>setBudgets(prev=>({...prev,[l]:{...prev[l],hardCap:v}}))} currency={currency}/>
      <small style={fine}>This lane cannot reserve more than its remaining hard budget.</small>
     </article>)}
    </div>
   </section>

   <section style={section}>
    <div style={sectionHead}><div><div style={eyebrow}>Providers</div><h2 style={h2}>Commissioning ladder</h2></div></div>
    <div style={providerGrid}>{(workspace?.connectors??[]).map(x=><StatusCard key={x.connectorId} label={x.lane+" · "+x.provider} value={x.admission}/>)}</div>
   </section>

   <section style={section}>
    <div style={sectionHead}><div><div style={eyebrow}>Bank sync</div><h2 style={h2}>Account freshness</h2></div></div>
    <div style={providerGrid}>
     {(workspace?.syncStates?.length??0)>0?workspace!.syncStates.map(x=><article style={card} key={x.syncId}><div style={strategyTitle}><strong>{x.provider}</strong><span style={x.state==="ACTIVE"?pill:x.state==="LOGIN_REQUIRED"?warningPill:dangerPill}>{x.state}</span></div><p style={fine}>Last successful sync: {x.lastSuccessfulSyncAt?new Date(x.lastSuccessfulSyncAt).toLocaleString():"Never recorded"}</p>{x.lastErrorCode&&<p style={fine}>Last error: {x.lastErrorCode}</p>}<p style={fine}>{x.includedAccountIds.length} included accounts</p></article>):<article style={card}><strong>No durable sync checkpoint yet</strong><p style={fine}>Connected read accounts can be promoted to cursor-backed sync after provider commissioning.</p></article>}
    </div>
   </section>

   <section style={section}>
    <div style={sectionHead}><div><div style={eyebrow}>Signer security</div><h2 style={h2}>Bounded wallet sessions</h2></div></div>
    <div style={providerGrid}>
     {(workspace?.signerLeases?.length??0)>0?workspace!.signerLeases.map(x=><article style={card} key={x.leaseId}><div style={strategyTitle}><strong>{x.agentId}</strong><span style={x.state==="ACTIVE"?pill:dangerPill}>{x.state}</span></div><p style={fine}>Expires {new Date(x.expiresAt).toLocaleString()}</p><p style={fine}>Per transaction: {fromMinor(x.perTransactionCapMinor)} · Rolling 24h: {fromMinor(x.rolling24hCapMinor)} · Max tx: {x.maxTransactionCount}</p><p style={fine}>Assets: {x.allowedAssets.join(", ")||"None"}</p></article>):<article style={card}><strong>No execution signer commissioned</strong><p style={fine}>Your Phantom owner wallet stays separate. A future automated DEX signer must be separately bounded and leased.</p></article>}
    </div>
   </section>

   <div style={saveBar}><div><strong>{money(totalAllocated,currency)} of {money(principalNumber,currency)} allocated</strong><div style={fine}>Saving policy cannot move funds or place trades.</div></div><button disabled={loading||saving} style={primary} type="submit">{saving?"Saving…":"Save Money policy"}</button></div>
  </form>
 </div></main>
}

function MoneyInput({label,value,setValue,currency}:{label:string;value:string;setValue:(v:string)=>void;currency:string}){return <label style={labelStyle}><span>{label}</span><div style={moneyBox}><span>{currency}</span><input value={value} onChange={e=>setValue(e.target.value)} inputMode="decimal" placeholder="0.00" style={bareInput}/></div></label>}
function PercentInput({label,value,setValue}:{label:string;value:string;setValue:(v:string)=>void}){return <label style={labelStyle}><span>{label}</span><div style={moneyBox}><input value={value} onChange={e=>setValue(e.target.value)} inputMode="decimal" placeholder="0" style={bareInput}/><span>%</span></div></label>}
function StatusCard({label,value}:{label:string;value:string}){return <article style={card}><div style={eyebrow}>{label}</div><strong style={{display:"block",marginTop:8}}>{value}</strong></article>}
function toMinor(v:string){const s=(v||"0").trim();if(!/^\d+(\.\d{1,2})?$/.test(s))throw new Error("Enter dollar amounts with no more than two decimal places.");const [w,d=""]=s.split(".");return(BigInt(w)*100n+BigInt((d+"00").slice(0,2))).toString()}
function fromMinor(v:string){const n=BigInt(v||"0");return (n/100n).toString()+"."+String(n%100n).padStart(2,"0")}
function percentToBps(v:string){const n=Number(v);if(!Number.isFinite(n)||n<0||n>100)throw new Error("Percentages must be between 0 and 100.");return Math.round(n*100)}
function safeNumber(v:string){const n=Number(v);return Number.isFinite(n)&&n>=0?n:0}
function money(v:number,currency:string){return new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:2}).format(v)}
function labelLane(l:Lane){return l==="MEME"?"Meme coins":l==="PREDICTION"?"Prediction markets":l[0]+l.slice(1).toLowerCase()}
function friendly(x:string){if(x.includes("FLOORS_INVALID"))return"Hard stop must be ≤ survival ≤ defensive ≤ principal.";if(x.includes("ALLOCATIONS_EXCEED_PRINCIPAL"))return"Strategy allocations cannot exceed the Coffer principal target.";if(x.includes("CAP_EXCEEDS_ALLOCATION"))return"A strategy hard cap cannot exceed its allocation.";return x}

const shell={minHeight:"100vh",background:"linear-gradient(180deg,#f6f1e9,#edf2ed)",color:"#29332e",padding:"30px 18px 120px",fontFamily:'ui-rounded,"Avenir Next",system-ui,sans-serif'}
const wrap={maxWidth:1120,margin:"0 auto"}
const top={display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-start",flexWrap:"wrap" as const}
const topActions={display:"flex",gap:8,flexWrap:"wrap" as const}
const eyebrow={fontSize:10,letterSpacing:".18em",textTransform:"uppercase" as const,color:"#77847c"}
const h1={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:"clamp(42px,8vw,68px)",letterSpacing:"-.05em",margin:"8px 0 0"}
const h2={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:29,margin:"6px 0 0"}
const sub={color:"#718078",lineHeight:1.65,maxWidth:780}
const linkButton={textDecoration:"none",border:"1px solid #ccd5cf",borderRadius:999,padding:"9px 13px",color:"#34443c",fontSize:13,background:"rgba(255,255,255,.6)"}
const section={marginTop:32}
const sectionHead={display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-end",flexWrap:"wrap" as const}
const cardGrid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginTop:14}
const strategyGrid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12,marginTop:14}
const providerGrid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12,marginTop:14}
const card={padding:18,borderRadius:22,background:"rgba(255,255,255,.72)",border:"1px solid #dce2dd",display:"grid",gap:12}
const labelStyle={display:"grid",gap:7,fontSize:12,color:"#657169"}
const label=labelStyle
const moneyBox={display:"flex",alignItems:"center",gap:8,border:"1px solid #d6ddd8",borderRadius:14,background:"#fff",padding:"0 11px"}
const bareInput={width:"100%",border:0,outline:"none",padding:"12px 0",fontSize:16,background:"transparent",color:"#29332e"}
const input={border:"1px solid #d6ddd8",borderRadius:14,background:"#fff",padding:"12px",fontSize:15,color:"#29332e"}
const strategyTitle={display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}
const pill={fontSize:10,padding:"5px 8px",borderRadius:999,background:"#e6efe8",color:"#3f6350"}
const warningPill={...pill,background:"#efe4ca",color:"#6f5a25"}
const dangerPill={...pill,background:"#f3e4e1",color:"#743b36"}
const fine={fontSize:11,color:"#7b867f",lineHeight:1.5}
const toggle={display:"flex",gap:8,alignItems:"center",fontSize:12,color:"#56665d"}
const summary={display:"flex",gap:12,flexWrap:"wrap" as const,fontSize:12,color:"#657169"}
const alert={marginTop:16,padding:14,borderRadius:16,background:"#f3e4e1",color:"#743b36"}
const success={marginTop:16,padding:14,borderRadius:16,background:"#e6efe8",color:"#3f6350",display:"grid",gap:5}
const saveBar={position:"sticky" as const,bottom:12,marginTop:32,padding:16,borderRadius:22,background:"rgba(52,68,60,.96)",color:"#f8f6f1",display:"flex",justifyContent:"space-between",gap:18,alignItems:"center",flexWrap:"wrap" as const,boxShadow:"0 12px 40px rgba(36,48,42,.18)"}
const primary={border:0,borderRadius:999,padding:"12px 18px",background:"#f8f6f1",color:"#34443c",fontWeight:800,cursor:"pointer"}
