import { NextRequest, NextResponse } from 'next/server'
import { observeVerifiedWallet } from '@jhadina/shark-intelligence-core/meme-trader'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let body: { address?: unknown }
  try { body = await request.json() as { address?: unknown } }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }
  if (typeof body.address !== 'string') return NextResponse.json({ error: 'wallet_address_required' }, { status: 400 })

  const rpcUrl = process.env.SOLANA_RPC_URL ?? process.env.HELIUS_RPC_URL
  if (!rpcUrl) return NextResponse.json({ error: 'shark_intelligence_unavailable', reason: 'Solana RPC provider is not configured' }, { status: 503 })

  const endpoint = process.env.ARKHAM_WALLET_ENDPOINT
  const apiKey = process.env.ARKHAM_API_KEY
  const arkham = endpoint && apiKey ? { endpoint, apiKey } : undefined
  try {
    const observations = await observeVerifiedWallet(body.address, { rpcUrl, arkham })
    return NextResponse.json({ address: body.address, observations, sources: observations.map(x => x.source), observedAt: new Date().toISOString() })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown SHARK wallet intelligence failure'
    const invalid = reason === 'Invalid Solana wallet address.'
    return NextResponse.json({ error: invalid ? 'invalid_wallet_address' : 'shark_intelligence_provider_error', reason }, { status: invalid ? 400 : 502 })
  }
}
