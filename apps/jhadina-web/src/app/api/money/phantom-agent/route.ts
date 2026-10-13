import { NextResponse } from 'next/server'
import { verifyPhantomAgentNativeSol } from '@jhadina/money-core'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const noStore = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' }
type WorkerObservation = Parameters<typeof verifyPhantomAgentNativeSol>[0]['observation']

function blocked(reason: string) {
  return NextResponse.json({
    success: true,
    data: {
      status: 'BLOCKED' as const,
      reason,
      ownerWallet: false,
      cofferExecutionWallet: false,
      canSign: false,
      canMoveMoney: false,
      canExecute: false,
      financialAuthority: 'NONE' as const,
    },
  }, { headers: noStore })
}

/**
 * Authenticated OWNER-ONLY view; never expose agent bearer tokens or session.
 * No PUT/POST endpoints exist. Worker host is selected only by trusted env.
 */
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return NextResponse.json({ success: false, error: 'unauthorized' },
      { status: 401, headers: noStore })
  }
  const owner = process.env.PHANTOM_AGENT_OWNER_USER_ID
  if (!owner || owner !== data.user.id) {
    return NextResponse.json({ success: false, error: 'forbidden' },
      { status: 403, headers: noStore })
  }
  const walletId = process.env.PHANTOM_AGENT_PIN_WALLET_ID
  const address = process.env.PHANTOM_AGENT_PIN_SOLANA_ADDRESS
  const workerUrl = process.env.PHANTOM_AGENT_OBSERVER_URL
  const bearerToken = process.env.PHANTOM_AGENT_OBSERVER_BEARER_TOKEN
  const rpcUrl = process.env.SOLANA_RPC_URL
  if (!walletId || !address || !workerUrl || !bearerToken || !rpcUrl) {
    return blocked('OWNER_HOST_NOT_COMMISSIONED')
  }
  if (bearerToken.length < 32) return blocked('WORKER_TOKEN_INVALID')
  let url: URL
  try { url = new URL(workerUrl) } catch { return blocked('WORKER_URL_INVALID') }
  if (url.protocol !== 'https:' || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/v1/observation') {
    return blocked('WORKER_HTTPS_ENDPOINT_REQUIRED')
  }
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { authorization: 'Bearer ' + bearerToken, accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return blocked('WORKER_OBSERVATION_UNAVAILABLE')
    const raw = await response.text()
    if (Buffer.byteLength(raw, 'utf8') > 8192) return blocked('WORKER_RESPONSE_TOO_LARGE')
    const candidate: unknown = JSON.parse(raw)
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return blocked('WORKER_RESPONSE_INVALID')
    }
    const observation = candidate as WorkerObservation
    const chain = await verifyPhantomAgentNativeSol({
      observation, expectedWalletId: walletId, expectedAddress: address, rpcUrl,
    })
    // No Phantom raw token prices, credentials or wallet-session information.
    return NextResponse.json({
      success: true,
      data: {
        status: 'INDEPENDENT_RPC_OBSERVED' as const,
        ownerWallet: false,
        cofferExecutionWallet: false,
        network: 'SOLANA' as const,
        address: chain.address,
        balanceLamports: chain.balanceLamports,
        slot: chain.slot,
        observedAt: chain.observedAt,
        chainEvidenceHash: chain.evidenceHash,
        providerEvidenceHash: chain.phantomEvidenceHash,
        verifiedNativeSolOnly: true,
        canSign: false,
        canMoveMoney: false,
        canExecute: false,
        financialAuthority: 'NONE' as const,
      },
    }, { headers: noStore })
  } catch {
    return blocked('INDEPENDENT_VERIFICATION_FAILED')
  }
}
