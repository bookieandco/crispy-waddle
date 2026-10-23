'use client'

import { useEffect, useState } from 'react'
import { connectPhantom, disconnectPhantom, getPhantomProvider, signOwnershipChallenge } from '../../lib/wallet/phantom'
import { loadRegisteredWallets, registerWallet, removeRegisteredWallet, type RegisteredWallet } from '../../lib/wallet/registry'

type WalletServerResponse = {
  ok?: boolean
  verified?: boolean
  challengeId?: string
  message?: string
  address?: string
  error?: string
}

async function walletRequest(method: 'POST' | 'DELETE', body: Record<string, unknown>): Promise<WalletServerResponse> {
  const result = await fetch('/api/wallet/ownership', {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  })
  const payload: WalletServerResponse = await result.json()
  if (!result.ok || payload.ok !== true) throw new Error(payload.error ?? 'Wallet verification unavailable')
  return payload
}

const OWNER_ID = 'local-user' // UI-only label; server authorization uses Supabase Auth user ID.

export function PhantomWalletButton() {
  const [wallet, setWallet] = useState<RegisteredWallet | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const existing = loadRegisteredWallets().find((item) => item.provider === 'phantom' && item.chain === 'solana')
    setWallet(existing ?? null)
    if (existing) {
      // Browser storage cannot prove ownership; the server remains authoritative.
      fetch('/api/wallet/ownership?address=' + encodeURIComponent(existing.address), {
        credentials:'same-origin',cache:'no-store',
      }).then(async response => {
        if (!response.ok) return null
        return response.json() as Promise<WalletServerResponse>
      }).then(result => {
        if (cancelled || !result || result.ok !== true || result.verified !== true ||
            result.address !== existing.address) return
        setWallet(current => current?.address === existing.address
          ? {...current,connectionState:'ownership-verified'}:current)
      }).catch(() => { /* fail closed, unverified */ })
    }
    return () => {cancelled = true}
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
    } finally {setBusy(false)}
  }

  async function verifyOwnership() {
    if (!wallet) return
    setBusy(true)
    setError(null)
    try {
      const challenge = await walletRequest('POST',{action:'challenge',address:wallet.address})
      if (!challenge.challengeId || !challenge.message)
        throw new Error('Server did not return a usable ownership challenge.')
      const signature = await signOwnershipChallenge(wallet.address, challenge.message)
      const signatureBase64 = btoa(String.fromCharCode(...signature))
      const outcome = await walletRequest('POST',{
        action:'verify', address:wallet.address,
        challengeId:challenge.challengeId, signatureBase64,
      })
      if (!outcome.verified || outcome.address !== wallet.address)
        throw new Error('Server has not verified wallet ownership.')
      // Display only. No browser-local verified claim is persisted or trusted.
      setWallet(current => current?.address === wallet.address
        ? {...current,connectionState:'ownership-verified'}:current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Wallet ownership verification failed.')
    } finally {setBusy(false)}
  }

  async function disconnect() {
    if (!wallet) return
    setBusy(true)
    setError(null)
    try {
      // Revoke server ownership observation before removing browser registration.
      await walletRequest('DELETE',{address:wallet.address})
      await disconnectPhantom()
      removeRegisteredWallet(wallet.walletId)
      setWallet(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to revoke wallet connection.')
    } finally {setBusy(false)}
  }

  const detected = Boolean(getPhantomProvider())

  if (!wallet) return (
    <section>
      <button type="button" onClick={connect} disabled={busy}>
        {busy ? 'Connecting…' : 'Connect Phantom'}
      </button>
      <p>{detected ? 'Phantom detected. Jhadina will register a public address only.' : 'Open this page inside Phantom’s browser to connect.'}</p>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )

  return (
    <section>
      <p>Phantom: {wallet.address.slice(0, 6)}…{wallet.address.slice(-6)}</p>
      <p>Ownership: {wallet.connectionState === 'ownership-verified' ? 'server-verified, observation only' : 'not verified'}</p>
      <p>Observation: enabled · Live trading: disabled · No wallet keys stored</p>
      {wallet.connectionState !== 'ownership-verified' ? (
        <button type="button" onClick={verifyOwnership} disabled={busy}>
          {busy ? 'Waiting for Phantom…' : 'Verify ownership securely'}
        </button>
      ) : null}
      <button type="button" onClick={disconnect} disabled={busy}>Disconnect and revoke</button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )
}
