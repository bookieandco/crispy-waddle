"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type { MoneyAccount, MoneyTransaction } from "@jhadina/money-core"
import { buildMoneyCommandCenterModel } from "@/lib/money/command-center-model"
import { MoneyConnectBankButton } from "./connect-bank-button"
import { PhantomWalletCard } from "./phantom-wallet-card"

type TransactionsResponse={success:true;data:{transactions:MoneyTransaction[]}}|{success:false;error:string}
type AccountsResponse={success:true;data:{accounts:MoneyAccount[];verifiedUserId:string}}|{success:false;error:string}
type WorkspaceSnapshot={
 coffer:null|{cofferId:string;currency:string;principalCapitalMinor:string;hardStopFloorMinor:string;survivalFloorMinor:string;defensiveFloorMinor:string;state:"ACTIVE"|"DEFENSIVE"|"SURVIVAL"|"HALTED"|"RECAPITALIZATION_REQUIRED"}
 sweepPolicy:null|{thresholdMinor:string;retainMinor:string;planningReserveBps:number;enabled:boolean;verifiedOwnerDestinationId:string|null;standingMandateId:string|null}
 wallets:readonly {connectionId:string;provider:string;network:string;address:string;mode:"OWNER_WALLET"|"COFFER_EXECUTION_WALLET";status:"ACTIVE"|"DISCONNECTED"|"REVOKED"}[]
 connectors:readonly {connectorId:string;provider:string;lane:"STOCK"|"FOREX"|"DEX";admission:"UNCOMMISSIONED"|"READ_ONLY"|"SHADOW"|"CONTROLLED_CANARY"|"LIVE"}[]
}
type WorkspaceResponse={success:true;data:WorkspaceSnapshot}|{success:false;error:string}

export default function MoneyCommandCenter(){
 const [accounts,setAccounts]=useState<MoneyAccount[]>([])
 const [transactions,setTransactions]=useState<MoneyTransaction[]>([])
 const [workspace,setWorkspace]=useState<WorkspaceSnapshot|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 const [workspaceError,setWorkspaceError]=useState("")
 const model=useMemo(()=>buildMoneyCommandCenterModel(accounts,transactions),[accounts,transactions])

 useEffect(()=>{
  let active=true
  const loadAccounts=async()=>{
   const response=await fetch("/api/money/accounts",{method:"GET",credentials:"same-origin",cache:"no-store"})
   const payload=await response.json() as AccountsResponse
   if(!response.ok||!payload.success)throw new Error(payload.success?"Could not load accounts":payload.error)
   if(active)setAccounts(payload.data.accounts)
   const sets=await Promise.all(payload.data.accounts.map(async account=>{
    const r=await fetch(`/api/money/transactions?accountId=${encodeURIComponent(account.externalId)}`,{method:"GET",credentials:"same-origin",cache:"no-store"})
    const body=await r.json() as TransactionsResponse
    return r.ok&&body.success?body.data.transactions:[]
   }))
   if(active)setTransactions(sets.flat())
  }
  const loadWorkspace=async()=>{
   const response=await fetch("/api/money/workspace",{method:"GET",credentials:"same-origin",cache:"no-store"})
   const payload=await response.json() as WorkspaceResponse
   if(!response.ok||!payload.success)throw new Error(payload.success?"Could not load Money workspace":payload.error)
   if(active)setWorkspace(payload.data)
  }
  void Promise.allSettled([
   loadAccounts().catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load accounts")}),
   loadWorkspace().catch(e=>{if(active)setWorkspaceError(e instanceof Error?e.message:"Could not load Money workspace")}),
  ]).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[])

 const available=model.availableCash===null?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:model.currency??"USD"}).format(model.availableCash)
 const money=(minor:string|undefined,currency="USD")=>minor===undefined?"—":new Intl.NumberFormat("en-US",{style:"currency",currency}).format(Number(minor)/100)
 const connector=(lane:"STOCK"|"FOREX"|"DEX")=>workspace?.connectors.find(x=>x.lane===lane)

 return <main style={shell}><div style={wrap}>
  <div style={topbar}>
   <div><div style={eyebrow}>Jhadina · Money Core</div><h1 style={h1}>Money</h1></div>
   <div style={nav}><Link style={navLink} href="/ask-jhadina?surface=money&route=/money/command-center">Ask Jhadina</Link><Link style={navLink} href="/money/commissioning">Configure Money</Link><Link style={navLink} href="/money/live-operations">Live Operations</Link></div>
  </div>
  <p style={sub}>Your Coffer, funding accounts, crypto wallet, markets, accountant controls, and live execution status in one workspace.</p>

  <section style={hero}>
   <div><span style={heroLabel}>Connected available cash</span><strong style={{fontSize:36}}>{loading?"Loading…":available}</strong><small style={heroSmall}>Funding accounts are separate from the Coffer. Automated strategies cannot pull rescue capital from them.</small></div>
   <div style={heroActions}><MoneyConnectBankButton/><Link href="/money/funding?action=deposit" style={lightButton}>Add funds</Link><Link href="/money/funding?action=withdrawal" style={lightButton}>Cash out</Link></div>
  </section>

  {(error||workspaceError)&&<div role="alert" style={alert}>{error&&<>Accounts: {error}</>}{error&&workspaceError?<br/>:null}{workspaceError&&<>Money workspace: {workspaceError}</>}</div>}

  <section style={grid}>
   <article style={darkCard}>
    <div style={sectionHead}><div><div style={darkEyebrow}>Coffer</div><h2 style={darkH2}>Operating capital</h2></div><span style={darkPill}>{workspace?.coffer?.state??"NOT COMMISSIONED"}</span></div>
    {workspace?.coffer?<div style={statGrid}>
     <Stat label="Principal" value={money(workspace.coffer.principalCapitalMinor,workspace.coffer.currency)} dark/>
     <Stat label="Defensive floor" value={money(workspace.coffer.defensiveFloorMinor,workspace.coffer.currency)} dark/>
     <Stat label="Survival floor" value={money(workspace.coffer.survivalFloorMinor,workspace.coffer.currency)} dark/>
     <Stat label="Hard stop" value={money(workspace.coffer.hardStopFloorMinor,workspace.coffer.currency)} dark/>
    </div>:<p style={darkMuted}>Coffer policy is software-ready but no owner Coffer row has been commissioned for this session.</p>}
    <div style={dividerDark}/>
    <div style={darkMuted}>Profit sweeps use realized, settled net profit only. Fees/costs, planning reserve, retained profit and survival floors are deducted before a sweep can be proposed.</div>
    {workspace?.sweepPolicy&&<div style={miniRow}><span>Profit threshold</span><strong>{money(workspace.sweepPolicy.thresholdMinor,workspace.coffer?.currency??"USD")}</strong></div>}
   </article>

   <article style={card}>
    <div style={sectionHead}><div><div style={eyebrow}>Funding desk</div><h2 style={h2}>Move money</h2></div><span style={pill}>Approval gated</span></div>
    <p style={muted}>Deposit into the Coffer, prepare a cash-out, or transfer between verified owner endpoints. Quotes and instructions can be prepared here; live provider movement remains governed and reconciled.</p>
    <div style={buttonRow}>
     <Link href="/money/funding?action=deposit" style={button}>Deposit</Link>
     <Link href="/money/funding?action=withdrawal" style={button}>Withdraw</Link>
     <Link href="/money/funding?action=transfer" style={button}>Transfer</Link>
    </div>
    <div style={miniRow}><span>Accountant control</span><strong>Double-entry + tie-out</strong></div>
   </article>
  </section>

  <section style={section}>
   <div style={sectionTitleRow}><div><div style={eyebrow}>Wallets</div><h2 style={h2}>Crypto custody</h2></div><span style={muted}>{workspace?.wallets.length??0} saved connections</span></div>
   <div style={grid}><PhantomWalletCard savedConnection={workspace?.wallets.find(x=>x.provider==="phantom"&&x.network==="SOLANA")}/><article style={card}><div style={eyebrow}>Coffer execution wallet</div><h3 style={h3}>Isolated signing boundary</h3><p style={muted}>Reserved for separately commissioned DEX automation. It is capital-limited, destination-allowlisted, reconciled, and separate from your Phantom owner wallet.</p><span style={pill}>Not commissioned</span></article></div>
  </section>

  <section style={section}>
   <div style={sectionTitleRow}><div><div style={eyebrow}>Markets</div><h2 style={h2}>Connector openings</h2></div><Link href="/money/live-operations" style={textLink}>Open operations →</Link></div>
   <div style={marketGrid}>
    <MarketCard title="Stocks" lane="STOCK" row={connector("STOCK")}/>
    <MarketCard title="Forex" lane="FOREX" row={connector("FOREX")}/>
    <MarketCard title="DEX / Crypto" lane="DEX" row={connector("DEX")}/>
   </div>
  </section>

  <section style={section}>
   <div style={sectionTitleRow}><div><div style={eyebrow}>Accounts</div><h2 style={h2}>Connected funding accounts</h2></div><span style={pill}>{accounts.length}</span></div>
   <div style={card}>
    {!loading&&accounts.length===0&&!error&&<p style={muted}>No connected accounts were returned.</p>}
    {accounts.map(account=>{
     const balance=account.availableBalance??account.currentBalance
     return <article key={account.id} style={row}><div><strong>{account.maskedName??account.type}</strong><div style={muted}>{account.type} · {account.provider}</div></div><strong>{typeof balance==="number"?new Intl.NumberFormat("en-US",{style:"currency",currency:account.currency==="UNKNOWN"?"USD":account.currency}).format(balance):"Balance unavailable"}</strong></article>
    })}
   </div>
  </section>

  <section style={section}>
   <div style={sectionTitleRow}><div><div style={eyebrow}>Accountant</div><h2 style={h2}>Needs attention</h2></div><span style={pill}>{model.attention.length}</span></div>
   <div style={card}>
    <p style={muted}>{model.transactionAttentionAvailable?"Derived from separately governed transaction reads. Review items never authorize a payment, transfer, withdrawal, or trade.":"Transaction intelligence appears after an owned account returns governed history."}</p>
    {model.attention.map(item=><article key={item.id} style={row}><div><strong>{item.title}</strong><div style={muted}>{item.severity} · {item.action}</div></div>{typeof item.amount==="number"&&<strong>{new Intl.NumberFormat("en-US",{style:"currency",currency:item.currency??"USD"}).format(item.amount)}</strong>}</article>)}
   </div>
  </section>

  <section style={boundary}><strong>Controlled live boundary</strong><span>The existing tiny Alpaca equity canary remains manual, permit-bound, reconciled, and kill-switch protected. Stock, forex, DEX, bank movement, and Coffer-wallet providers stay fail-closed until their own commissioning evidence exists.</span></section>
 </div></main>
}

function Stat({label,value,dark=false}:{label:string;value:string;dark?:boolean}){return <div><div style={dark?darkMuted:muted}>{label}</div><strong>{value}</strong></div>}
function MarketCard({title,lane,row}:{title:string;lane:string;row:WorkspaceSnapshot["connectors"][number]|undefined}){return <article style={card}><div style={sectionHead}><div><div style={eyebrow}>{lane}</div><h3 style={h3}>{title}</h3></div><span style={pill}>{row?.admission??"UNCOMMISSIONED"}</span></div><p style={muted}>{row?.provider??"Provider opening reserved. No execution provider has been admitted."}</p></article>}

const shell={minHeight:"100vh",background:"linear-gradient(180deg,#f6f1e9,#edf2ed)",color:"#29332e",padding:"30px 18px 100px",fontFamily:'ui-rounded,"Avenir Next",system-ui,sans-serif'}
const wrap={maxWidth:1080,margin:"0 auto"}
const topbar={display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-start",flexWrap:"wrap" as const}
const nav={display:"flex",gap:9,flexWrap:"wrap" as const}
const navLink={textDecoration:"none",border:"1px solid #ccd5cf",borderRadius:999,padding:"9px 13px",color:"#34443c",fontSize:13,background:"rgba(255,255,255,.55)"}
const eyebrow={fontSize:10,letterSpacing:".2em",textTransform:"uppercase" as const,color:"#77847c"}
const h1={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:"clamp(44px,10vw,72px)",letterSpacing:"-.05em",margin:"7px 0 0"}
const h2={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:28,margin:"5px 0 0"}
const h3={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:23,margin:"5px 0 0"}
const sub={color:"#718078",lineHeight:1.6,maxWidth:760,marginTop:6}
const hero={marginTop:24,padding:24,borderRadius:30,background:"#34443c",color:"#f8f6f1",display:"flex",justifyContent:"space-between",gap:22,alignItems:"center",flexWrap:"wrap" as const}
const heroLabel={display:"block",fontSize:11,textTransform:"uppercase" as const,letterSpacing:".12em",opacity:.7,marginBottom:6}
const heroSmall={display:"block",opacity:.7,maxWidth:620,lineHeight:1.5,marginTop:5}
const heroActions={display:"flex",gap:9,flexWrap:"wrap" as const,alignItems:"center"}
const lightButton={textDecoration:"none",border:"1px solid rgba(255,255,255,.35)",borderRadius:999,padding:"10px 14px",color:"#f8f6f1",fontSize:13}
const grid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:14,marginTop:14}
const marketGrid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:14,marginTop:14}
const card={padding:22,borderRadius:26,background:"rgba(255,255,255,.72)",border:"1px solid #dce2dd"}
const darkCard={padding:22,borderRadius:26,background:"#34443c",color:"#f8f6f1"}
const darkEyebrow={...eyebrow,color:"rgba(248,246,241,.58)"}
const darkH2={...h2,color:"#f8f6f1"}
const darkMuted={color:"rgba(248,246,241,.68)",fontSize:13,lineHeight:1.6}
const dividerDark={height:1,background:"rgba(255,255,255,.15)",margin:"18px 0"}
const section={marginTop:30}
const sectionTitleRow={display:"flex",justifyContent:"space-between",gap:15,alignItems:"end",flexWrap:"wrap" as const}
const sectionHead={display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}
const statGrid={display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:16,marginTop:20}
const muted={color:"#718078",fontSize:13,lineHeight:1.6}
const pill={fontSize:10,padding:"6px 9px",borderRadius:999,background:"#edf2ed",color:"#56665d",whiteSpace:"nowrap" as const}
const darkPill={...pill,background:"rgba(255,255,255,.12)",color:"#f8f6f1"}
const buttonRow={display:"flex",gap:9,flexWrap:"wrap" as const,marginTop:16}
const button={textDecoration:"none",border:"1px solid #34443c",background:"#34443c",color:"#f8f6f1",borderRadius:999,padding:"10px 14px",fontSize:13}
const miniRow={display:"flex",justifyContent:"space-between",gap:14,borderTop:"1px solid rgba(120,130,123,.18)",paddingTop:14,marginTop:14,fontSize:12,color:"#657169"}
const row={display:"flex",justifyContent:"space-between",gap:15,alignItems:"center",padding:"16px 0",borderBottom:"1px solid #e5e9e5"}
const alert={marginTop:14,padding:14,borderRadius:16,background:"#f3e4e1",color:"#743b36"}
const boundary={marginTop:30,padding:20,borderRadius:24,border:"1px solid #dce2dd",display:"grid",gap:7,color:"#56665d",fontSize:13}
const textLink={color:"#34443c",fontSize:13}
