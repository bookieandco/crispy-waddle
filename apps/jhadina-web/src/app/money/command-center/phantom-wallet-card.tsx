"use client"

import { useState } from "react"
import { connectPhantomSolana,disconnectPhantomSolana,getPhantomSolanaProvider,openMoneyInPhantom } from "@/lib/money/phantom-wallet"

export function PhantomWalletCard(){
 const [address,setAddress]=useState<string|null>(null)
 const [error,setError]=useState("")
 const [busy,setBusy]=useState(false)
 const [providerAvailable]=useState(()=>typeof window!=="undefined"&&Boolean(getPhantomSolanaProvider()))
 const connect=async()=>{setBusy(true);setError("");try{const x=await connectPhantomSolana();setAddress(x.address)}catch(e){setError(e instanceof Error?e.message:"Could not connect Phantom")}finally{setBusy(false)}}
 const disconnect=async()=>{setBusy(true);try{await disconnectPhantomSolana();setAddress(null)}finally{setBusy(false)}}
 return <article style={cardStyle}>
  <div style={rowStyle}><div><div style={eyebrow}>Owner wallet</div><h3 style={h3}>Phantom · Solana</h3></div><span style={pill}>{address?"Connected":"Not connected"}</span></div>
  <p style={muted}>{address?short(address):"Connect Phantom for owner-visible crypto balances, deposits, withdrawals and user-approved signing. Money Core never receives your seed phrase or private key."}</p>
  {error&&<div role="alert" style={alert}>{error==="MONEY_PHANTOM_NOT_INSTALLED"?"Phantom is not available in this browser.":error}</div>}
  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
   <button type="button" onClick={address?disconnect:connect} disabled={busy||(!address&&!providerAvailable)} style={button}>{busy?"Working…":address?"Disconnect":"Connect Phantom"}</button>
   {!address&&!providerAvailable&&<button type="button" onClick={()=>openMoneyInPhantom()} style={secondaryButton}>Open in Phantom</button>}
  </div>
  <small style={fine}>Unattended DEX automation uses a separate, bounded Coffer custody boundary after separate commissioning.</small>
 </article>
}
const short=(x:string)=>x.length>16?x.slice(0,7)+"…"+x.slice(-7):x
const cardStyle={padding:20,borderRadius:24,background:"rgba(255,255,255,.72)",border:"1px solid #dce2dd",display:"grid",gap:12}
const rowStyle={display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}
const eyebrow={fontSize:10,letterSpacing:".16em",textTransform:"uppercase" as const,color:"#77847c"}
const h3={fontFamily:'Georgia,"Times New Roman",serif',fontWeight:400,fontSize:24,margin:"5px 0 0"}
const pill={fontSize:11,padding:"6px 10px",borderRadius:999,background:"#edf2ed",color:"#56665d"}
const muted={color:"#718078",fontSize:13,lineHeight:1.6,margin:0}
const fine={color:"#7b867f",fontSize:11,lineHeight:1.5}
const alert={padding:10,borderRadius:12,background:"#f3e4e1",color:"#743b36",fontSize:12}
const button={border:"1px solid #34443c",background:"#34443c",color:"#f8f6f1",borderRadius:999,padding:"10px 14px",cursor:"pointer"}

const secondaryButton={border:"1px solid #ccd5cf",background:"transparent",color:"#34443c",borderRadius:999,padding:"10px 14px",cursor:"pointer"}
