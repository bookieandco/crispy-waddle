import { NextRequest, NextResponse } from 'next/server'
import { collectHeliusLaunch, type HeliusLaunchWebhookEvent } from '@jhadina/shark-intelligence-core/meme-trader'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { persistSharkLaunch } from '@/lib/shark/launch-repository'

export const runtime = 'nodejs'

function authorized(request: NextRequest): boolean {
  const expected = process.env.HELIUS_WEBHOOK_SECRET
  if (!expected) return false
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? request.headers.get('x-helius-auth')
  return supplied === expected
}

export async function POST(request: NextRequest) {
  if (!process.env.HELIUS_WEBHOOK_SECRET) return NextResponse.json({ error: 'shark_launch_ingestion_unavailable', reason: 'Helius webhook secret is not configured' }, { status: 503 })
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized_webhook' }, { status: 401 })
  let payload: unknown
  try { payload = await request.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }
  const client = createServiceRoleClient()
  if (!client) return NextResponse.json({ error: 'shark_launch_ingestion_unavailable', reason: 'Supabase service-role persistence is not configured' }, { status: 503 })
  const events = Array.isArray(payload) ? payload : [payload]
  const collections = events.filter((event): event is HeliusLaunchWebhookEvent => typeof event === 'object' && event !== null).map(event => collectHeliusLaunch(event)).filter((result): result is NonNullable<typeof result> => result !== null)
  for (const result of collections) await persistSharkLaunch(client, result)
  return NextResponse.json({ received: events.length, accepted: collections.length, ignored: events.length - collections.length, launches: collections.map(result => ({ launchId: result.ingested.launch.launchId, tokenAddress: result.ingested.launch.tokenAddress, observationId: result.observation.observationId, duplicate: result.ingested.duplicate, signature: result.signature, slot: result.slot })) })
}
