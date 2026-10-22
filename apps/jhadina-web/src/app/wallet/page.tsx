import Link from 'next/link'
import {PhantomWalletCard} from '../money/command-center/phantom-wallet-card'

/** Reuse the canonical authenticated Money Core ownership verifier instead
 * of the legacy localStorage-only wallet registry that cannot attest ownership.
 */
export default function WalletPage(){
 return <main style={{maxWidth:720,margin:'0 auto',padding:24}}>
  <h1>Wallet</h1>
  <p>Connect Phantom for read-only Solana wallet observation. Signing the one-time ownership message does not permit spending or live trading.</p>
  <PhantomWalletCard/>
  <p><Link href="/money/command-center">Open Jhadina Money Command Center</Link></p>
 </main>
}
