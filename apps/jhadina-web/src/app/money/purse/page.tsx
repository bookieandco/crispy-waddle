'use client'
import Link from 'next/link'
import {useEffect,useState} from 'react'
import type {PurseSelfFundingSnapshot} from '@/lib/money/purse-self-funding-status'

const fmt=(minor:string|null,currency:string|null)=>{
 if(minor===null||!currency)return 'Not evidenced'
 const a=BigInt(minor)
 return (a<0n?'-':'')+(currency==='USD'?'$':currency+' ')+
   ((a<0n?-a:a)/100n).toLocaleString('en-US')+'.'+String((a<0n?-a:a)%100n).padStart(2,'0')
}
const panel={border:'1px solid #dfdfdf',borderRadius:18,padding:18,background:'#fff'}
const small={fontSize:13,opacity:.68,lineHeight:1.55} as const
export default function PurseSelfFundingPage(){
 const [snapshot,setSnapshot]=useState<PurseSelfFundingSnapshot|null>(null)
 const [message,setMessage]=useState('')
 useEffect(()=>{let active=true
  fetch('/api/money/purse/self-funding',{cache:'no-store',credentials:'same-origin'})
   .then(async r=>{const x=await r.json() as {ok:boolean,snapshot?:PurseSelfFundingSnapshot,error?:string}
     if(!r.ok||!x.ok||!x.snapshot)throw Error(x.error||'Read-only Purse status unavailable')
     if(active)setSnapshot(x.snapshot)})
   .catch(e=>{if(active)setMessage(e instanceof Error?e.message:'Status unavailable')})
  return()=>{active=false}
 },[])
 const c=snapshot?.cofferCurrency??null
 const metrics=[
  ['Verified settled revenue',snapshot?.verifiedSettledRevenueMinor??null],
  ['Direct costs',snapshot?.verifiedDirectCostsMinor??null],
  ['Provider fees',snapshot?.verifiedProviderFeesMinor??null],
  ['Tax and obligation reserve',snapshot?.verifiedTaxReserveMinor??null],
  ['Distributable profit',snapshot?.verifiedDistributableProfitMinor??null],
  ['Protected owner payday',snapshot?.verifiedOwnerPaydayMinor??null],
 ] as const
 return <main style={{minHeight:'100vh',padding:'28px 18px 64px',background:'#f5f3ef',color:'#242b27'}}>
  <div style={{maxWidth:900,margin:'0 auto'}}>
   <Link href="/money/command-center" style={{fontSize:14,color:'inherit'}}>← Money Command Center</Link>
   <p style={{...small,margin:'25px 0 0',letterSpacing:1.3,textTransform:'uppercase'}}>Jhadina · Treasury</p>
   <h1 style={{fontSize:'clamp(30px,7vw,48px)',lineHeight:1.05,margin:'8px 0 12px'}}>Her Purse, her operating runway.</h1>
   <p style={{...small,maxWidth:680}}>Owner-only, read-only evidence. No simulated income becomes spendable cash. No wallet signing or transfers occur on this page.</p>
   {message&&<section role="alert" style={{...panel,marginTop:20,color:'#8f302c'}}>{message}</section>}
   {!snapshot&&!message&&<p role="status" style={{marginTop:22}}>Reading the governed Money workspace…</p>}
   {snapshot&&<>
    <div role="status" style={{...panel,marginTop:24,background:'#fdf5e4'}}>
     <strong>Not commissioned for self-funding</strong>
     <div style={{...small,marginTop:7}}>Coffer: {snapshot.cofferRegistered?'Registered':'Not registered'} · Funding rail: {snapshot.fundingRailAdmission} · First paid business cycle: not independently verified</div>
    </div>
    <section aria-label="Financial evidence" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12,marginTop:18}}>
     {metrics.map(([label,value])=><article key={label} style={panel}>
       <div style={small}>{label}</div>
       <strong style={{display:'block',fontSize:23,marginTop:9}}>{fmt(value,c)}</strong>
      </article>)}
    </section>
    <section style={{...panel,marginTop:18}}>
     <h2 style={{fontSize:20,marginTop:0}}>Capital and protections</h2>
     <div style={small}>Hard-stop reserve: {fmt(snapshot.protectedFloors?.hardStopMinor??null,c)}</div>
     <div style={small}>Survival reserve: {fmt(snapshot.protectedFloors?.survivalMinor??null,c)}</div>
     <div style={small}>Defensive reserve: {fmt(snapshot.protectedFloors?.defensiveMinor??null,c)}</div>
     <div style={small}>Owner payout destination: {snapshot.ownerPayoutDestinationConfigured?'Configured in Money':'Not verified'}</div>
     <div style={small}>Operating runway: Not evidenced — requires verified recurring costs and liquid custody</div>
    </section>
    <section style={{...panel,marginTop:18}}>
     <h2 style={{fontSize:20,marginTop:0}}>Commercial schema checks</h2>
     {snapshot.schemaChecks.map(x=><div key={x.name} style={{...small,padding:'9px 0',borderBottom:'1px solid #eee',overflowWrap:'anywhere'}}>{x.name} — <strong>{x.state.replace(/_/g,' ')}</strong></div>)}
     <p style={small}>Query permission is not proof of correct migrations, row-level security, genuine provider settlement or bank custody.</p>
    </section>
    <section aria-label="Live commissioning stages" style={{...panel,marginTop:18}}>
     <h2 style={{fontSize:20,marginTop:0}}>LIVE · .07–.10 acceptance</h2>
     {[
      ['.07 · Database restore','Independent backup/isolated restore and tenant RLS proof pending'],
      ['.08 · Stripe TEST','Signed payment, refund and journal readback pending'],
      ['.09 · iPhone Safari','Portrait navigation, protected session and logout acceptance pending'],
      ['.10 · First customer','Owner-approved client, delivery, settlement and custody evidence pending'],
     ].map(([stage,description])=><div key={stage} style={{padding:'12px 0',borderBottom:'1px solid #eee'}}>
      <strong>{stage}</strong><div style={small}>{description}</div>
     </div>)}
     <p style={small}>Agent Bank patterns are research-only. Jhadina does not have a connected Agent Bank account, independent transfer authority or verified customer revenue.</p>
    </section>
    <section style={{...panel,marginTop:18}}>
     <h2 style={{fontSize:20,marginTop:0}}>Remaining gates</h2>
     <ul>{snapshot.blockers.map(x=><li key={x} style={{...small,margin:'8px 0'}}>{x.replace(/_/g,' ')}</li>)}</ul>
     <p style={small}>Stripe TEST payments are rehearsals. The first real client needs independent payment, accepted delivery, refunds/fees, custody and owner-entitlement reconciliation.</p>
     <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
      <Link href="/money/commissioning" style={{color:'inherit'}}>View Money configuration →</Link>
      <Link href="/opportunity/side-hustles" style={{color:'inherit'}}>Business Factory →</Link>
     </div>
    </section>
   </>}
  </div>
 </main>
}
