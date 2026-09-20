import { NextRequest, NextResponse } from 'next/server'
import { collectHeliusLaunch, type HeliusLaunchWebhookEvent } from '@jhadina/shark-intelligence-core/meme-trader'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { persistSharkLaunch } from '@/lib/shark/launch-repository'

export const runtime = 'nodejs'

export function authorizedHeliusWebhook(headers: Headers, expected: string | undefined): boolean {
  if (!expected) return false
  // Helius sends the configured authHeader value verbatim in Authorization.
  // Do not strip Bearer or accept an undocumented alternate header: operators
  // must configure HELIUS_WEBHOOK_SECRET to the exact authHeader value.
  return headers.get('authorization') === expected
}

export async function POST(request: NextRequest) {
  if (!process.env.HELIUS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'shark_launch_ingestion_unavailable' }, { status: 503 })
  }
  if (!authorizedHeliusWebhook(request.headers, process.env.HELIUS_WEBHOOK_SECRET)) return NextResponse.json({ error: 'unauthorized_webhook' }, { status: 401 })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const client = createServiceRoleClient()
  if (!client) {
    return NextResponse.json({ error: 'shark_launch_ingestion_unavailable' }, { status: 503 })
  }

  const events = Array.isArray(payload) ? payload : [payload]
  if (events.length > 500) return NextResponse.json({ error: 'webhook_batch_too_large' }, { status: 413 })
  const collections = events
    .filter((event): event is HeliusLaunchWebhookEvent => typeof event === 'object' && event !== null)
    .map(event => collectHeliusLaunch(event))
    .filter((result): result is NonNullable<typeof result> => result !== null)

  try {
    const persisted = []
    for (const collection of collections) {
      persisted.push(await persistSharkLaunch(client, collection))
    }

    return NextResponse.json({
      received: events.length,
      accepted: collections.length,
      ignored: events.length - collections.length,
      persisted: persisted.length,
      launches: collections.map(result => ({
        launchId: result.ingested.launch.launchId,
        tokenAddress: result.ingested.launch.tokenAddress,
        observationId: result.observation.observationId,
        duplicate: result.ingested.duplicate,
        signature: result.signature,
        slot: result.slot,
      })),
    })
  } catch (error) {
    // Do not expose provider/database internals to webhook callers.
    console.error('SHARK launch persistence failed', error)
    return NextResponse.json({ error: 'shark_launch_ingestion_unavailable', reason: 'persistence_failed' }, { status: 503 })
  }
}
