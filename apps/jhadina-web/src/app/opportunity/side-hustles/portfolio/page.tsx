'use client'

import {useEffect,useState} from 'react'
import Link from 'next/link'

type FamilyAudit={
  family:string
  softwareReadiness:string
  commissioningStatus:string
  commercialEvidenceStatus:string
  reviewStatus:string
  linkedPaidWorkOrderIds:string[]
  liveEvidenceCounts:{lockedWorkOrders:number;acceptedDeliveries:number;realizedPaidOutcomes:number}
  blockers:string[]
  nextMilestones:string[]
  independentlyCertified:false
}
type PortfolioAudit={
  ok:true
  evaluatedAt:string
  summary:{total:number;readyForManualAcceptance:number;blocked:number;capabilityOnly:number;independentlyCertified:number}
  rows:FamilyAudit[]
  readOnly:true
}

export default function SideHustlePortfolioPage(){
  const [report,setReport]=useState<PortfolioAudit|null>(null)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{
    const abort=new AbortController()
    fetch('/api/side-hustles/portfolio/acceptance',{cache:'no-store',signal:abort.signal})
      .then(async response=>{
        if(!response.ok)throw new Error(response.status===401
          ? 'Sign in to inspect your own portfolio.'
          : 'Commercial storage or evidence is unavailable. No live certification can be inferred.')
        return response.json() as Promise<PortfolioAudit>
      })
      .then(data=>{if(!data.ok||!data.readOnly)throw new Error('Unable to verify the audit response');setReport(data)})
      .catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Audit unavailable')})
    return()=>abort.abort()
  },[])
  const title=(id:string)=>id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
  return <main style={{maxWidth:1100,margin:'0 auto',padding:'24px 16px 80px'}}>
    <Link href="/opportunity/side-hustles" style={{color:'inherit'}}>← Side Hustle Business Factory</Link>
    <header style={{marginTop:24,marginBottom:24}}>
      <p style={{fontSize:12,letterSpacing:1.3,opacity:.62}}>SH-PORTFOLIO.01 → FINAL</p>
      <h1 style={{fontSize:32,margin:'6px 0'}}>Live commercial evidence</h1>
      <p style={{maxWidth:760,lineHeight:1.5,opacity:.72}}>
        Read-only audit of canonical work orders, customer acceptance, domain outcomes and commissioning gates.
        A working software adapter is not a paid business. A transaction reference alone is not verified settlement.
      </p>
    </header>
    {!report&&!error?<p role="status">Checking available evidence…</p>:null}
    {error?<section role="alert" style={{padding:16,border:'1px solid currentColor',borderRadius:12}}>
      <h2 style={{fontSize:19,margin:'0 0 8px'}}>Live audit blocked</h2>
      <p style={{margin:0,lineHeight:1.5}}>{error}</p>
      <p style={{margin:'8px 0 0',opacity:.7}}>No evidence was manufactured, and no provider action was attempted.</p>
    </section>:null}
    {report?<section>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14}}>
        <span style={{padding:'7px 10px',border:'1px solid currentColor',borderRadius:9}}>
          Families: {report.summary.total}
        </span>
        <span style={{padding:'7px 10px',border:'1px solid currentColor',borderRadius:9}}>
          Blocked: {report.summary.blocked}
        </span>
        <span style={{padding:'7px 10px',border:'1px solid currentColor',borderRadius:9}}>
          Manual review candidates: {report.summary.readyForManualAcceptance}
        </span>
        <span style={{padding:'7px 10px',border:'1px solid currentColor',borderRadius:9}}>
          Independently certified: {report.summary.independentlyCertified}
        </span>
      </div>
      <p style={{fontSize:12,opacity:.65}}>Evaluated: {report.evaluatedAt} · No spend, outreach, bidding, publishing or trading authority</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,305px),1fr))',gap:12,marginTop:16}}>
        {report.rows.map(row=><article key={row.family}
          style={{padding:16,border:'1px solid color-mix(in srgb, currentColor 20%, transparent)',borderRadius:12}}>
          <h2 style={{fontSize:18,margin:'0 0 8px'}}>{title(row.family)}</h2>
          <p style={{fontSize:12,margin:'0 0 9px',opacity:.7}}>
            Software: {title(row.softwareReadiness)} · Commissioning: {title(row.commissioningStatus)}
          </p>
          <p style={{fontWeight:650,margin:'0 0 10px'}}>{title(row.reviewStatus)}</p>
          <p style={{fontSize:12,opacity:.75}}>
            Linked paid work orders: {row.linkedPaidWorkOrderIds.length}
            {' · '}Accepted deliveries: {row.liveEvidenceCounts.acceptedDeliveries}
            {' · '}Outcome observations: {row.liveEvidenceCounts.realizedPaidOutcomes}
          </p>
          <details>
            <summary style={{cursor:'pointer'}}>Blockers and next milestone</summary>
            <div style={{fontSize:13,lineHeight:1.5,marginTop:10}}>
              {row.blockers.length?<ul style={{paddingLeft:18}}>
                {row.blockers.map((reason,index)=><li key={index}>{reason}</li>)}
              </ul>:<p>No reported blockers; independent certification still requires a separate check.</p>}
              <strong>Next:</strong> {row.nextMilestones[0]??'Preserve capability-only boundary'}
            </div>
          </details>
          <p style={{fontSize:12,marginTop:12}}>
            <Link href={'/opportunity/side-hustles/'+row.family} style={{color:'inherit'}}>Open business family →</Link>
          </p>
        </article>)}
      </div>
    </section>:null}
  </main>
}
