import { NextRequest, NextResponse } from 'next/server'
import { observeVerifiedWallet } from '@jhadina/shark-intelligence-core/meme-trader'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: { address?: unknown }
  try {
    body = await request.json() as { address?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (typeof body.address !== 'string' || !body.address.trim()) {
    return NextResponse.json({ error: 'wallet_address_required' }, { status: 400 })
  }
  const address = body.address.trim()

  const serviceRole = createServiceRoleClient()
  if (!serviceRole) return NextResponse.json({ error: 'shark_intelligence_unavailable' }, { status: 503 })
  const configuredLimit = Number(process.env.SHARK_WALLET_INTELLIGENCE_RATE_LIMIT ?? 30)
  const rateLimit = Number.isInteger(configuredLimit) && configuredLimit >= 1 && configuredLimit <= 300 ? configuredLimit : 30
  const { data: allowed, error: quotaError } = await serviceRole.rpc('jhadina_shark_consume_wallet_intelligence_quota', {
    p_user_id: user.id,
    p_limit: rateLimit,
    p_window_seconds: 60,
  })
  if (quotaError) {
    console.error('SHARK wallet intelligence quota failure', quotaError)
    return NextResponse.json({ error: 'shark_intelligence_unavailable' }, { status: 503 })
  }
  if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const rpcUrl = process.env.SOLANA_RPC_URL ?? process.env.HELIUS_RPC_URL
  if (!rpcUrl) {
    return NextResponse.json({ error: 'shark_intelligence_unavailable', reason: 'provider_not_configured' }, { status: 503 })
  }

  const endpoint = process.env.ARKHAM_WALLET_ENDPOINT
  const apiKey = process.env.ARKHAM_API_KEY
  const arkham = endpoint && apiKey ? { endpoint, apiKey } : undefined

  try {
    const observations = await observeVerifiedWallet(address, { rpcUrl, arkham })
    return NextResponse.json({
      address,
      observations,
      sources: [...new Set(observations.map(x => x.source))],
      observedAt: new Date().toISOString(),
    })
  } catch (error) {
    const invalid = error instanceof Error && error.message === 'Invalid Solana wallet address.'
    if (invalid) return NextResponse.json({ error: 'invalid_wallet_address' }, { status: 400 })

    console.error('SHARK wallet intelligence provider failure', error)
    return NextResponse.json({ error: 'shark_intelligence_provider_error', reason: 'provider_request_failed' }, { status: 502 })
  }
}
