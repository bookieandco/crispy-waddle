'use client'

import { useEffect, useState } from 'react'
import { connectPhantom, disconnectPhantom, getPhantomProvider, signOwnershipChallenge } from '../../lib/wallet/phantom'
import { loadRegisteredWallets, markWalletOwnershipVerified, registerWallet, removeRegisteredWallet, type RegisteredWallet } from '../../lib/wallet/registry'

const OWNER_ID = 'local-user'

export function PhantomWalletButton() {
  const [wallet, setWallet] = useState<RegisteredWallet | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const existing = loadRegisteredWallets().find((item) => item.provider === 'phantom' && item.chain === 'solana')
    setWallet(existing ?? null)
  }, [])

  async function connect() {
    setBusy(true)
    setError(null)
    try {
      const address = await connectPhantom()
      const registered = registerWallet({ ownerId: OWNER_ID, address, provider: 'phantom' })
      setWallet(registered)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to connect Phantom.')
    } finally {
      setBusy(false)
    }
  }

  async function verifyOwnership() {
    if (!wallet) return
    setBusy(true)
    setError(null)
    try {
      // Signing is deliberately separate from connect and does not authorize a transaction.
      await signOwnershipChallenge(wallet.address)
      setWallet(markWalletOwnershipVerified(wallet.walletId) ?? wallet)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ownership verification failed.')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    setError(null)
    try {
      await disconnectPhantom()
      if (wallet) removeRegisteredWallet(wallet.walletId)
      setWallet(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to disconnect Phantom.')
    } finally {
      setBusy(false)
    }
  }

  const detected = Boolean(getPhantomProvider())

  if (!wallet) {
    return (
      <section>
        <button type="button" onClick={connect} disabled={busy}>
          {busy ? 'Connecting…' : 'Connect Phantom'}
        </button>
        <p>{detected ? 'Phantom detected. Jhadina will register the public address only.' : 'Phantom not detected in this browser.'}</p>
        {error ? <p role="alert">{error}</p> : null}
      </section>
    )
  }

  return (
    <section>
      <p>Phantom: {wallet.address.slice(0, 6)}…{wallet.address.slice(-6)}</p>
      <p>Ownership: {wallet.connectionState === 'ownership-verified' ? 'verified' : 'not verified'}</p>
      <p>Observation: enabled · Live trading: disabled</p>
      {wallet.connectionState !== 'ownership-verified' ? (
        <button type="button" onClick={verifyOwnership} disabled={busy}>
          {busy ? 'Waiting for Phantom…' : 'Verify ownership'}
        </button>
      ) : null}
      <button type="button" onClick={disconnect} disabled={busy}>Disconnect</button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )
}
