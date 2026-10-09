import Link from 'next/link'
import {ShadowPaperStatusPanel} from '../purse/purse-status-panel'

/** Historical source identifiers remain money_purse_paper_* for backward compatibility. */
export default function MoneyShadowPage(){
 const card={padding:20,border:'1px solid #dce2dd',borderRadius:22,background:'#fff',display:'grid',gap:12} as const
 const link={display:'inline-flex',padding:'11px 15px',borderRadius:999,background:'#34443c',color:'#fff',textDecoration:'none',fontSize:13} as const
 return <main style={{minHeight:'100vh',padding:'24px 16px 100px',background:'linear-gradient(#f4f6fa,#edf2ed)',color:'#29332e'}}>
  <div style={{maxWidth:840,margin:'0 auto',display:'grid',gap:18}}>
   <header style={{display:'grid',gap:8}}>
    <div style={{fontSize:11,letterSpacing:'.2em',textTransform:'uppercase'}}>Money Core · SHARK intelligence</div>
    <h1 style={{fontFamily:'Georgia,serif',fontWeight:400,fontSize:'clamp(34px,8vw,58px)',margin:0}}>SHADOW paper lab</h1>
    <p style={{lineHeight:1.6,color:'#58675e',margin:0}}>Simulated trading, independent outcome checks, strategy calibration, and the original SHADOW ledger recovery belong here—not in your live-money Purse balance.</p>
    <strong style={{color:'#8a5b22',fontSize:13}}>Paper research only · no real orders, deposits, withdrawals, wallet signing, or money movement.</strong>
   </header>
   <ShadowPaperStatusPanel/>
   <section style={card}>
    <h2 style={{margin:0}}>Original history versus forward-only paper runs</h2>
    <p style={{margin:0,lineHeight:1.6}}>The original SHADOW history is not recovered. New forward-only paper evidence is distinct and cannot be represented as past actual trades. Learning requires real point-in-time source evidence, matured outcome horizons, cost modeling, and independently restored durable storage.</p>
   </section>
   <section style={card}>
    <h2 style={{margin:0}}>From SHADOW to Purse</h2>
    <p style={{margin:0,lineHeight:1.6}}>SHADOW findings can adjust future strategy ranking and simulated capital choices. Only the owner-governed Purse and downstream Money Core authority chain can later allocate real money or request live execution.</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
     <Link style={link} href="/money/purse">Open real-money Purse</Link>
     <Link style={{...link,background:'#edf2ed',color:'#34443c'}} href="/money/command-center">Money Core</Link>
    </div>
   </section>
  </div>
 </main>
}
