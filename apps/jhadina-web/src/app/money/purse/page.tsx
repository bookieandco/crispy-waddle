import Link from 'next/link'
import {MoneyConnectBankButton} from '../command-center/connect-bank-button'
import {PhantomWalletCard} from '../command-center/phantom-wallet-card'
import {PurseLiveReadinessPanel} from './purse-live-readiness-panel'

/** Purse = owner-governed real-capital treasury. SHADOW owns simulated trading/learning. */
export default function JhadinaPursePage(){
 const link={display:'inline-flex',padding:'11px 15px',borderRadius:999,background:'#34443c',color:'#fff',textDecoration:'none',fontSize:13} as const
 const light={...link,background:'#eff3ed',color:'#34443c',border:'1px solid #d4ded6'} as const
 const card={padding:20,border:'1px solid #dce2dd',borderRadius:22,background:'#fff',display:'grid',gap:12} as const
 return <main style={{minHeight:'100vh',padding:'24px 16px 100px',background:'linear-gradient(#f6f1e9,#edf2ed)',color:'#29332e'}}>
  <div style={{maxWidth:840,margin:'0 auto',display:'grid',gap:18}}>
   <header style={{display:'grid',gap:8}}>
    <div style={{fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase'}}>Jhadina · Owner treasury</div>
    <h1 style={{fontFamily:'Georgia,serif',fontWeight:400,fontSize:'clamp(36px,8vw,60px)',margin:0}}>The Purse</h1>
    <p style={{lineHeight:1.6,color:'#58675e',margin:0}}>Your real-money treasury: capital, protected reserves, bank and crypto funding, strategy budgets, and owner profits. Money Core manages risk and execution under your approved limits. SHARK supplies intelligence; SHADOW tests and learns without moving funds.</p>
    <strong style={{color:'#8a5b22',fontSize:13}}>Live movement and automated trades require verified account, provider, mandate and execution readiness.</strong>
   </header>
   <PurseLiveReadinessPanel/>
   <section style={card} aria-label="Purse capital controls">
    <div><small>Real capital · Owner-governed</small><h2 style={{margin:'6px 0'}}>Capital, reserves and profits</h2></div>
    <p style={{margin:0,lineHeight:1.6}}>Set principal targets, hard-stop and emergency reserves, strategy allocations, and the owner profit-sweep policy. Policy targets never count as deposited or settled cash.</p>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
     <Link style={link} href="/money/command-center">View Purse balances</Link>
     <Link style={light} href="/money/commissioning">Owner capital controls</Link>
     <Link style={light} href="/money/live-operations">Live readiness</Link>
    </div>
   </section>
   <section style={card} aria-label="USD funding">
    <div><small>USD · Owner bank</small><h2 style={{margin:'6px 0'}}>Add or withdraw dollars</h2></div>
    <p style={{margin:0,lineHeight:1.6}}>Link your account and prepare bank → Purse deposits or Purse → verified owner bank withdrawals. A linked bank is not automatically authorized for ACH transfers.</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
     <MoneyConnectBankButton/>
     <Link style={link} href="/money/funding?action=deposit">Add USD</Link>
     <Link style={light} href="/money/funding?action=withdrawal">Withdraw USD</Link>
    </div>
    <small style={{color:'#67766c'}}>Requests go to owner approvals. No transfer occurs without a certified funding rail, approval, permit and settlement reconciliation.</small>
   </section>
   <section style={card} aria-label="Purse crypto custody">
    <div><small>SOL / USDC · Solana</small><h2 style={{margin:'6px 0'}}>Connect your Phantom wallet</h2></div>
    <PhantomWalletCard/>
    <p style={{margin:0,lineHeight:1.6}}>Phantom is your external owner wallet. Automated execution uses a separately commissioned, limited Purse custody wallet—not your Phantom seed phrase. Connection alone does not establish a wallet-ownership signature or an executable funding rail.</p>
    <Link style={light} href="/money/command-center">Wallet and signing readiness</Link>
   </section>
   <section style={card} aria-label="SHADOW research lab">
    <div><small>Money Core · SHARK · SHADOW</small><h2 style={{margin:'6px 0'}}>Paper trading and learning</h2></div>
    <p style={{margin:0,lineHeight:1.6}}>Simulations, forward-only paper ledgers, SHARK market observations, and outcome grading belong to SHADOW. They inform future Purse allocations, but never substitute for actual available money, settled profits, or trading authorization.</p>
    <Link style={light} href="/money/shadow">Open SHADOW paper lab</Link>
   </section>
  </div>
 </main>
}
