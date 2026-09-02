import { PhantomWalletButton } from '../../components/wallet/PhantomWalletButton'

export default function WalletPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1>Wallet</h1>
      <p>Connect a Solana wallet for Jhadina observation and identity verification.</p>
      <p>Jhadina never requests or stores your seed phrase or private key. Connecting does not enable trading.</p>
      <PhantomWalletButton />
    </main>
  )
}
