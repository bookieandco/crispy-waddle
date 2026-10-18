import Link from 'next/link'
import {
  ZERO_RIG_METHODS, assessZeroRigAction, evaluateZeroRigPaperPilot,
  projectZeroRigDashboard,
} from '@jhadina/opportunity-core'

const surface = {border:'1px solid rgba(128,128,128,.28)', borderRadius:18,padding:18,background:'rgba(128,128,128,.055)'} as const
const small = {fontSize:12,opacity:.68,lineHeight:1.55} as const
const grid = {display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,240px),1fr))',gap:12} as const
const label = {fontSize:11,letterSpacing:1.4,textTransform:'uppercase' as const,opacity:.68} as const

export default function ZeroRigEarningsPage(){
  // This is an explicitly disconnected read model, not a personal wallet/balance API.
  // A future authorized server reader must supply canonical Money Core outcomes.
  const now = new Date().toISOString()
  const pilot = evaluateZeroRigPaperPilot({
    experimentId:'zero-rig:paper:uncommissioned', startDate:now.slice(0,10),asOf:now,observations:[],
  })
  const dashboard = projectZeroRigDashboard({outcomes:[],pending:[],pilot})
  const external = assessZeroRigAction('submit_bounty')

  return <main style={{maxWidth:1080,margin:'0 auto',padding:'28px 18px 120px',lineHeight:1.5}}>
    <Link href="/opportunity" style={{color:'inherit',opacity:.72,textDecoration:'none'}}>← Opportunities</Link>
    <header style={{margin:'22px 0 24px'}}>
      <div style={label}>Jhadina • Resource Earnings Lab</div>
      <h1 style={{fontSize:'clamp(28px,6vw,42px)',margin:'7px 0 8px'}}>Zero-Rig Intelligence</h1>
      <p style={{opacity:.75,maxWidth:720,margin:0}}>
        Discover ways to earn crypto without a specialized mining rig. Compare evidence, effort and estimated economics before any owner-authorized action.
      </p>
      <p style={{margin:'12px 0 0',fontSize:12,fontWeight:700}}>RESEARCH / PAPER ONLY — no connected wallets, earning feeds, payments or automatic submissions.</p>
    </header>

    <section aria-label="Earnings overview" style={grid}>
      <div style={surface}><div style={label}>Verified payout receipts loaded</div><div style={{fontSize:30,fontWeight:700}}>{dashboard.verifiedPayoutCount}</div><div style={small}>No Money Core feed is connected to this view. This is not an account balance.</div></div>
      <div style={surface}><div style={label}>Paper experiment</div><div style={{fontSize:30,fontWeight:700}}>{pilot.observedDays}/{pilot.plannedDays}</div><div style={small}>Dated observations recorded in this session fixture; no experiment has been scheduled.</div></div>
      <div style={surface}><div style={label}>External execution</div><div style={{fontSize:22,fontWeight:700}}>Blocked</div><div style={small}>{external.reason}</div></div>
    </section>

    <section style={{marginTop:32}}>
      <h2 style={{fontSize:22,margin:'0 0 14px'}}>Ways Jhadina could earn</h2>
      <div style={grid}>
        {ZERO_RIG_METHODS.map(method=><article key={method.id} style={surface}>
          <div style={label}>{method.mechanism.replaceAll('_',' ')}</div>
          <h3 style={{fontSize:17,margin:'8px 0 7px'}}>{method.label}</h3>
          <div style={small}>Uses: {method.equipment.replaceAll('_',' ')} · Reward: {method.rewardKind.replaceAll('_',' ')}</div>
          <p style={{fontSize:13,margin:'10px 0'}}>{method.limitations[0]}</p>
          <a href={method.referenceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:13,color:'inherit',textDecoration:'underline'}}>Official reference ↗</a>
          <div style={{...small,marginTop:10}}>Discovery research only • Not an active income source</div>
        </article>)}
      </div>
    </section>

    <section style={{marginTop:32,...surface}}>
      <h2 style={{fontSize:21,margin:'0 0 6px'}}>Seven-day paper pilot</h2>
      <p style={{...small,margin:'0 0 14px'}}>A template for seven daily checks, not seven days of historical results. Every observation needs date-specific evidence. No live collection or future schedule is active.</p>
      <div style={{...grid,gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,115px),1fr))'}}>
        {pilot.daily.map((day,index)=><div key={day.date} style={{padding:11,border:'1px solid rgba(128,128,128,.25)',borderRadius:12}}>
          <div style={label}>Day {index+1}</div><div style={{fontSize:13,fontWeight:600,marginTop:3}}>{day.date}</div>
          <div style={{...small,marginTop:5}}>{day.status==='pending'?'No observation':'Paper evidence'}</div>
        </div>)}
      </div>
    </section>

    <section style={{marginTop:18,...surface}}>
      <h2 style={{fontSize:19,margin:'0 0 5px'}}>What remains before earnings are real?</h2>
      <p style={{fontSize:13,opacity:.8,margin:0}}>
        Source-specific eligibility, official current bounty terms, monitored API costs, operator-approved credentials,
        human review, and authenticated Money Core payout reconciliation. No payouts are inferred from points, modeled returns or pending rewards.
      </p>
    </section>
  </main>
}
