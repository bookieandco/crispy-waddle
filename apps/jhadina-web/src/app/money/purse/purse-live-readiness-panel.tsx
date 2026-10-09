'use client'
import {useEffect,useState} from 'react'
type Status=Readonly<{
 treasury:null|{state:string;currency:string}
 ownerPayoutDestinationRecorded:boolean
 fundingRailExecutable:boolean
 activeMandateRecordCount:number
 configuredExecutionWallet:boolean
 boundedSignerLeaseRecorded:boolean
 marketProviderAdmitted:boolean
 blockers:readonly string[]
 liveAutomatedTradingCertified:false
 canExecute:false
 canMoveMoney:false
}>
type Response={success:true;data:Status}|{success:false;error:string}
export function PurseLiveReadinessPanel(){
 const [status,setStatus]=useState<Status|null>(null)
 const [failure,setFailure]=useState('')
 useEffect(()=>{
  const ac=new AbortController()
  fetch('/api/money/purse/live-readiness',{credentials:'same-origin',cache:'no-store',signal:ac.signal})
   .then(async r=>{
    const x=await r.json() as Response
    if(!r.ok||!x.success)throw new Error('Live Purse evidence unavailable')
    if(!ac.signal.aborted)setStatus(x.data)
   })
   .catch(()=>{if(!ac.signal.aborted)setFailure('Storage or owner session unavailable; live trading remains blocked')})
  return()=>ac.abort()
 },[])
 const yes=(x:boolean)=>x?'Recorded — verification still required':'Not commissioned'
 const items=status?[
  ['Treasury policy',status.treasury?.state??'Not configured'],
  ['Owner payout destination',yes(status.ownerPayoutDestinationRecorded)],
  ['Funding provider',yes(status.fundingRailExecutable)],
  ['Owner-approved mandate',status.activeMandateRecordCount>0?'Mandate record found — not live authorization':'Not active'],
  ['Isolated execution wallet',yes(status.configuredExecutionWallet)],
  ['Bounded signer lease',yes(status.boundedSignerLeaseRecorded)],
  ['Market provider',yes(status.marketProviderAdmitted)],
 ]:[]
 return <section aria-label="Real-money Purse commissioning" style={{padding:20,border:'1px solid #dce2dd',borderRadius:22,background:'#fff',display:'grid',gap:12}}>
  <div style={{display:'grid',gap:5}}>
   <small style={{letterSpacing:'.14em',color:'#687c6e'}}>PURSE · LIVE ACCOUNTABILITY</small>
   <h2 style={{margin:0}}>Automatic money management readiness</h2>
   <p style={{margin:0,lineHeight:1.6,color:'#58675e'}}>Purse operates real capital only after independently verified custody, owner limits, signed provider authorization, and durable recovery. SHADOW paper outcomes never count as settled money.</p>
  </div>
  <strong style={{color:'#8a5b22'}}>Live automatic trading: NOT CERTIFIED</strong>
  {failure?<p role="status" style={{color:'#8a5b22'}}>{failure}</p>:null}
  {!failure&&!status?<p role="status">Checking owner-scoped Purse readiness…</p>:null}
  {status?<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))',gap:8}}>
   {items.map(([name,value])=><div key={name} style={{border:'1px solid #dce2dd',borderRadius:12,padding:10,display:'grid',gap:5}}>
    <small style={{color:'#58675e'}}>{name}</small>
    <strong style={{fontSize:13}}>{value}</strong>
   </div>)}
  </div>:null}
  {status&&status.blockers.length>0?<details><summary>Commissioning blockers ({status.blockers.length})</summary>
   <ul style={{fontSize:12,lineHeight:1.7}}>{status.blockers.map(s=><li key={s}>{s.replaceAll('_',' ').toLowerCase()}</li>)}</ul></details>:null}
  <small style={{color:'#687c6e'}}>This is a read-only diagnostic. No button here grants a trading mandate, authorizes ACH, signs wallet transactions, or moves funds.</small>
 </section>
}
