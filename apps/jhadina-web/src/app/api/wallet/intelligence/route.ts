import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { observeVerifiedWallet } from '@jhadina/shark-intelligence-core/meme-trader/wallet-intelligence'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { walletId?: unknown } | null
  if (!body || typeof body.walletId !== 'string' || !body.walletId) {
    return NextResponse.json({ error: 'walletId is required' }, { status: 400 })
  }

  const { data: wallet, error: walletError } = await supabase
    .from('jhadina_wallets')
    .select('wallet_id,address,chain,ownership_verified,observation_enabled,trading_enabled')
    .eq('wallet_id', body.walletId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (walletError) return NextResponse.json({ error: walletError.message }, { status: 500 })
  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
  if (!wallet.ownership_verified) return NextResponse.json({ error: 'Wallet ownership is not verified' }, { status: 403 })
  if (!wallet.observation_enabled) return NextResponse.json({ error: 'Wallet observation is disabled' }, { status: 409 })
  if (wallet.chain !== 'solana') return NextResponse.json({ error: 'Only Solana wallets are supported by this observer' }, { status: 400 })

  const rpcUrl = process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL
  if (!rpcUrl) return NextResponse.json({ error: 'Solana RPC is not configured' }, { status: 503 })

  const arkhamApiKey = process.env.ARKHAM_API_KEY
  const arkhamEndpoint = process.env.ARKHAM_WALLET_ENDPOINT
  const observations = await observeVerifiedWallet(wallet.address, {
    rpcUrl,
    ...(arkhamApiKey && arkhamEndpoint ? { arkham: { apiKey: arkhamApiKey, endpoint: arkhamEndpoint } } : {}),
  })

  const rows = observations.map(observation => ({
    observation_id: `${observation.source}:${wallet.wallet_id}:${observation.observedAt}:${observation.source === 'solana-rpc' ? observation.slot : 'snapshot'}`,
    wallet_id: wallet.wallet_id,
    owner_id: user.id,
    source: observation.source,
    observed_at: observation.observedAt,
    payload: observation,
  }))

  const { error: insertError } = await supabase
    .from('jhadina_wallet_intelligence_observations')
    .upsert(rows, { onConflict: 'observation_id', ignoreDuplicates: true })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({
    walletId: wallet.wallet_id,
    address: wallet.address,
    observations: observations.map(o => ({ source: o.source, observedAt: o.observedAt })),
    tradingEnabled: wallet.trading_enabled,
  })
}
