'use client'

import { useState } from 'react'

type Listing = {
  id:string;title:string;sourceUrl:string;agentAccess:string;listingType:string
  deadline:string;skills:string[];rewardAmount:number|null;rewardCurrency:string|null
}
type Result = { ok?:boolean;error?:string;result?:{
  listings:Listing[];observedAt:string;rejectedCount:number;warnings:string[]
}}

export function ZeroRigLiveScout(){
  const [data,setData]=useState<Result|null>(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('Not connected. A read requires an owner-only agent key and feature flag.')
  async function check(){
    setBusy(true);setData(null);setMessage('Checking read-only provider listings…')
    try{
      const res=await fetch('/api/opportunities/zero-rig/superteam?mode=list&take=20',{
        method:'GET',cache:'no-store',credentials:'same-origin',
      })
      const body=await res.json() as Result
      if(!res.ok){setMessage(
        res.status===503?'Agent key or read-only access has not been commissioned.'
          :res.status===401?'Sign in to Jhadina first.'
          :res.status===403?'Owner-only access is required.'
          :res.status===429?'Provider rate limit; no retry was attempted.'
          :'Provider is unavailable. No results were invented.'
      );return}
      setData(body);setMessage('Read-only source observations; verify official details before evaluating any bounty.')
    }catch{setMessage('Could not load listings. No real rewards or eligibility are inferred.')}
    finally{setBusy(false)}
  }
  return <section style={{marginTop:24,border:'1px solid rgba(128,128,128,.3)',borderRadius:18,padding:18}} aria-label="Superteam agent discovery">
    <h2 style={{fontSize:21,margin:'0 0 8px'}}>Superteam agent bounty scout</h2>
    <p style={{opacity:.78,fontSize:13}}>Owner-only and read-only. It cannot register, submit, claim, spend, or modify an account.</p>
    <button type="button" onClick={()=>void check()} disabled={busy}
      style={{padding:'11px 16px',borderRadius:10,border:'1px solid currentColor',background:'transparent',color:'inherit',fontWeight:700,cursor:busy?'wait':'pointer'}}>
      {busy?'Checking…':'Check live listings'}
    </button>
    <p role="status" style={{fontSize:12,opacity:.8}}>{message}</p>
    {data?.result && <>
      <p style={{fontSize:12,opacity:.7}}>Observed {data.result.observedAt} · {data.result.listings.length} research candidates · {data.result.rejectedCount} rejected/unmatched</p>
      {data.result.warnings.map((warning,index)=><p key={index} style={{fontSize:12,opacity:.7}}>{warning}</p>)}
      <div style={{display:'grid',gap:10}}>
      {data.result.listings.map(listing=><article key={listing.id} style={{border:'1px solid rgba(128,128,128,.2)',borderRadius:12,padding:12}}>
        <div style={{fontSize:11,opacity:.72}}>{listing.agentAccess} · {listing.listingType} · Deadline {listing.deadline.slice(0,10)}</div>
        <div style={{fontWeight:700,marginTop:4}}>{listing.title}</div>
        <div style={{fontSize:12,marginTop:4,opacity:.72}}>Prize claim: {listing.rewardAmount===null?'Unknown':String(listing.rewardAmount)} {listing.rewardCurrency??'units unspecified'} · Not verified</div>
        <div style={{fontSize:12,opacity:.72}}>Skills: {listing.skills.join(', ')||'Not verified'}</div>
        <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:13,color:'inherit',textDecoration:'underline'}}>Review official listing ↗</a>
      </article>)}
      </div>
    </>}
  </section>
}
