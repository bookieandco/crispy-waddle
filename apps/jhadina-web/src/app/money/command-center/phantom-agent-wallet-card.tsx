'use client'

import { useCallback, useEffect, useState } from 'react'

type AgentStatus =
  | { status: 'BLOCKED'; reason: string; canSign: false; canExecute: false; financialAuthority: 'NONE' }
  | { status: 'INDEPENDENT_RPC_OBSERVED'; network: 'SOLANA'; address: string;
      balanceLamports: string; slot: number; observedAt: string;
      chainEvidenceHash: string; verifiedNativeSolOnly: true;
      canSign: false; canExecute: false; financialAuthority: 'NONE' }

function formatLamports(value: string): string {
  if (!/^\d+$/.test(value)) return '—'
  const lamports = BigInt(value)
  const whole = lamports / 1000000000n
  const fraction = (lamports % 1000000000n).toString().padStart(9, '0')
  return whole.toString() + '.' + fraction + ' SOL'
}
const short = (value: string) => value.length > 18
  ? value.slice(0, 8) + '…' + value.slice(-8) : value

/**
 * Phantom MCP agent wallet is NOT the Phantom owner-wallet connection or the
 * Coffer execution wallet. No action here can sign, trade, fund or transfer.
 */
export function PhantomAgentWalletCard() {
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/money/phantom-agent', {
        method: 'GET', credentials: 'same-origin', cache: 'no-store',
      })
      const data = await response.json() as { success: boolean; data?: AgentStatus; error?: string }
      if (!response.ok || !data.success || !data.data) {
        throw new Error('Agent wallet monitoring is unavailable.')
      }
      if (data.data.canSign !== false || data.data.canExecute !== false ||
          data.data.financialAuthority !== 'NONE') {
        throw new Error('Unsafe wallet authority response rejected.')
      }
      setStatus(data.data)
    } catch {
      setStatus(null)
      setError('Read-only agent wallet status could not be verified.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  return <article style={{ padding: 20, borderRadius: 24, background: 'rgba(255,255,255,.72)', border: '1px solid #dce2dd', display: 'grid', gap: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: '#77847c' }}>Agent wallet · separate custody</div>
        <h3 style={{ fontFamily: 'Georgia,serif', fontWeight: 400, fontSize: 24, margin: '5px 0 0' }}>Phantom MCP</h3>
      </div>
      <span style={{ fontSize: 11, padding: '6px 10px', borderRadius: 999, background: '#edf2ed', color: '#56665d' }}>
        {loading ? 'CHECKING' : status?.status === 'INDEPENDENT_RPC_OBSERVED' ? 'READ-ONLY' : 'BLOCKED'}
      </span>
    </div>
    {error && <p role="alert" style={{ color: '#743b36', fontSize: 12 }}>{error}</p>}
    {status?.status === 'INDEPENDENT_RPC_OBSERVED'
      ? <>
          <strong style={{ fontSize: 19 }}>{formatLamports(status.balanceLamports)}</strong>
          <small style={{ color: '#718078' }}>Confirmed native SOL from independent Solana RPC · slot {status.slot}</small>
          <small style={{ color: '#718078' }}>Agent: {short(status.address)} · {status.observedAt}</small>
          <small style={{ color: '#718078' }}>Evidence: {short(status.chainEvidenceHash)} · no token valuation claimed</small>
        </>
      : <p style={{ color: '#718078', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          {loading ? 'Checking authenticated observation…' :
            status?.status === 'BLOCKED' ? 'Not commissioned or observation blocked: ' + status.reason :
              'Dedicated agent wallet not verified.'}
        </p>}
    <button type="button" disabled={loading} onClick={() => void refresh()} style={{
      border: '1px solid #ccd5cf', color: '#34443c', background: 'transparent',
      borderRadius: 999, padding: '10px 14px', cursor: 'pointer',
    }}>{loading ? 'Checking…' : 'Refresh observation'}</button>
    <small style={{ color: '#7b867f', fontSize: 11, lineHeight: 1.5 }}>
      Observation is not spendable Coffer cash. Trading, wallet signing, swaps, transfers and leverage are disabled here.
    </small>
  </article>
}
