import Link from 'next/link'
import {MoneyConnectBankButton} from '../command-center/connect-bank-button'
import {PhantomWalletCard} from '../command-center/phantom-wallet-card'
import {PurseStatusPanel} from './purse-status-panel'

/**
 * Phone-first Purse entry point.
 * Never treat Plaid visibility, saved Phantom address or an uncommissioned rail as live payment authority.
 */
export default function JhadinaPursePage(){
 const link={display:'inline-flex',padding:'11px 15px',borderRadius:999,background:'#34443c',color:'#fff',textDecoration:'none',fontSize:13} as const
 const light={...link,background:'#eff3ed',color:'#34443c',border:'1px solid #d4ded6'} as const
 const card={padding:20,border:'1px solid #dce2dd',borderRadius:22,background:'#fff',display:'grid',gap:12} as const
 return <main style={{minHeight:'100vh',padding:'24px 16px 100px',background:'linear-gradient(#f6f1e9,#edf2ed)',color:'#29332e'}}>
  <div style={{maxWidth:840,margin:'0 auto',display:'grid',gap:18}}>
   <header style={{display:'grid',gap:8}}>
    <div style={{fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase'}}>Jhadina · Money Core</div>
    <h1 style={{fontFamily:'Georgia,serif',fontWeight:400,fontSize:'clamp(36px,8vw,60px)',margin:0}}>The Purse</h1>
    <p style={{lineHeight:1.6,color:'#58675e',margin:0}}>Fund the segregated Coffer in USD or crypto, then allow Jhadina to research and simulate allocations. Your bank and Phantom owner wallet remain separate from autonomous trading custody.</p>
    <strong style={{color:'#8a5b22',fontSize:13}}>Paper planning only · live funding depends on verified payment rails</strong>
   </header>
   <section style={card} aria-label="USD funding">
    <div><small>USD · Owner bank</small><h2 style={{margin:'6px 0'}}>Deposit or withdraw dollars</h2></div>
    <p style={{margin:0,lineHeight:1.6}}>Link your account using the existing Money connection. Prepare bank → Coffer deposits or Coffer → owner bank cash-outs in the Funding Desk. A linked bank is not automatically ACH-enabled.</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
     <MoneyConnectBankButton/>
     <Link style={link} href="/money/funding?action=deposit">Add USD</Link>
     <Link style={light} href="/money/funding?action=withdrawal">Withdraw USD</Link>
    </div>
    <small style={{color:'#67766c'}}>Proposals go to /approvals; no bank transfer occurs without provider certification, owner approval, permit and settlement reconciliation.</small>
   </section>
   <section style={card} aria-label="Phantom wallet">
    <div><small>SOL / USDC · Solana owner wallet</small><h2 style={{margin:'6px 0'}}>Connect Phantom</h2></div>
    <PhantomWalletCard/>
    <p style={{margin:0,lineHeight:1.6}}>A connected wallet exposes its public address, not custody. Crypto deposits and withdrawals require verified wallet ownership, isolated Coffer wallet, approved transfer and confirmed on-chain settlement. USD → USDC is a separate on-ramp conversion, not a bank transfer.</p>
    <Link style={light} href="/money/command-center">Review wallet and Coffer readiness</Link>
   </section>
   <PurseStatusPanel/>
   <section style={card}>
    <h2 style={{margin:0}}>Autonomous paper operation</h2>
    <p style={{margin:0,lineHeight:1.6}}>Purse paper decisions cannot submit bank movements, sign Phantom transactions, broadcast Solana transactions or place live trades. Learning requires independent, point-in-time evidence and durable checkpoints.</p>
    <div style={{display:'flex',gap:9,flexWrap:'wrap'}}>
     <Link style={light} href="/money/commissioning">Commissioning controls</Link>
     <Link style={light} href="/approvals">Owner approvals</Link>
    </div>
   </section>
  </div>
 </main>
}
