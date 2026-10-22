"use client";

import { useCallback, useEffect, useState } from "react";
import {
  connectPhantomSolana, getPhantomSolanaProvider, openMoneyInPhantom,
  signPhantomOwnershipMessage,
} from "@/lib/money/phantom-wallet";

const address = "Ecdudvb15AMFeE9B4KU9WqLQmGHzm57yUR9egZ5fG6Nq";
const endpoint = "https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-phantom-passwordless-claim";
type WalletReply = {success:boolean;error?:string;data?:{
  address?:string;verified?:boolean;challengeId?:string;message?:string;
  canTrade?:false;canSign?:false;
}};
async function call(action:"status"|"challenge"|"verify",extras:Record<string,string>={}) {
  const res=await fetch(endpoint,{method:"POST",mode:"cors",cache:"no-store",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({action,address,...extras})});
  const value=await res.json() as WalletReply;
  if(!res.ok||!value.success)throw new Error(value.error||"WALLET_VERIFICATION_UNAVAILABLE");
  return value.data||{};
}

export default function PasswordlessPhantomActivation() {
  const [hasProvider,setHasProvider]=useState(false);
  const [activeAddress,setActiveAddress]=useState("");
  const [verified,setVerified]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [stage,setStage]=useState("");

  const refresh=useCallback(async()=>{
    setHasProvider(Boolean(getPhantomSolanaProvider()));
    const info=await call("status");
    setVerified(info.verified===true);
    setActiveAddress(getPhantomSolanaProvider()?.publicKey?.toString()||"");
  },[]);
  useEffect(()=>{
    void refresh().catch(()=>setError("Activation status unavailable. No wallet action was performed."));
  },[refresh]);

  async function connect(){
    if(busy)return;
    setError("");setBusy(true);
    try{
      setStage("Connect your Phantom Solana account");
      const phantom=await connectPhantomSolana();
      setActiveAddress(phantom.address);
      if(phantom.address!==address)throw new Error("Different Phantom wallet detected. Switch to the approved wallet before continuing.");
      setStage("Preparing one-time, read-only ownership proof");
      const challenge=await call("challenge");
      if(!challenge.challengeId||!challenge.message)throw new Error("Missing ownership challenge");
      setStage("Approve SIGN MESSAGE only — never a transfer or trade");
      const signed=await signPhantomOwnershipMessage(challenge.message,address);
      setStage("Checking signature with Jhadina");
      const proof=await call("verify",{challengeId:challenge.challengeId,signatureBase64:signed});
      if(!proof.verified)throw new Error("Wallet was not verified");
      setVerified(true);
    }catch(e){
      setError(e instanceof Error?e.message:"Wallet connection failed");
      await refresh().catch(()=>{});
    }finally{setStage("");setBusy(false);}
  }
  function openPhantom(){
    try{openMoneyInPhantom(window.location.href);}catch{setError("Open this HTTPS link from Phantom's built-in browser.");}
  }
  return <main style={{minHeight:"100vh",maxWidth:620,margin:"0 auto",padding:"44px 20px 100px",fontFamily:"system-ui,sans-serif",color:"#26342d"}}>
    <div style={{fontSize:13,textTransform:"uppercase",letterSpacing:".13em",color:"#69766e"}}>Jhadina • Money Core • Phantom</div>
    <h1 style={{fontSize:38,margin:"16px 0"}}>Connect your wallet</h1>
    <p style={{fontSize:18,lineHeight:1.6}}>No Jhadina password required for this one-time, read-only wallet verification.</p>
    <section style={{border:"1px solid #cddbd0",background:"#f2f6f1",borderRadius:20,padding:22,display:"grid",gap:13}}>
      <div style={{fontSize:12,letterSpacing:".08em",textTransform:"uppercase"}}>Preapproved Solana wallet</div>
      <div style={{overflowWrap:"anywhere",fontFamily:"monospace",fontSize:13}}>{address}</div>
      <strong style={{color:verified?"#12613a":"#5b6259"}}>
        {verified?"Ownership verified · read-only":"Awaiting Phantom signature"}
      </strong>
      {activeAddress&&<small>Current Phantom address: {activeAddress.slice(0,7)}…{activeAddress.slice(-7)}</small>}
      {stage&&<p role="status" style={{margin:0}}>{stage}</p>}
      {error&&<p role="alert" style={{color:"#9d2733",margin:0}}>{error}</p>}
      {hasProvider
        ? <button type="button" disabled={busy} onClick={()=>void connect()} style={{padding:"15px 20px",borderRadius:12,background:"#263c31",color:"white",fontWeight:700,border:0}}>
            {busy?"Verifying…":verified?"Reverify with Phantom":"Connect & verify Phantom"}
          </button>
        : <button type="button" disabled={busy} onClick={openPhantom} style={{padding:"15px 20px",borderRadius:12,background:"#263c31",color:"white",fontWeight:700,border:0}}>
            Open in Phantom
          </button>}
      <small>Only approve <b>Sign Message</b>. If Phantom asks you to send SOL, swap tokens, or sign a transaction, cancel.</small>
    </section>
    {verified&&<p role="status" style={{marginTop:20,fontWeight:600}}>Wallet ownership was verified. Jhadina can recognize it for read-only observation. This does not unlock her private workspace or authorize real trading.</p>}
    <p style={{fontSize:13,lineHeight:1.6,color:"#63716a",marginTop:24}}>This page never asks for a password, seed phrase, or private key. Money Core, signer leases, deposits, withdrawals and SHARK live execution remain locked behind their existing separate controls.</p>
  </main>;
}
