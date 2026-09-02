import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SupabaseWatchlistRepository } from '@/lib/government-opportunities/supabase-oce-persistence'
import type { WatchlistEntry } from '@jhadina/opportunity-core'

export const dynamic = 'force-dynamic'

function watchlistId(userId: string, opportunityId: string, principalId?: string): string {
  return `watchlist:${userId}:${opportunityId}:${principalId ?? ''}`
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })

  try {
    const repository = new SupabaseWatchlistRepository()
    const entries = await repository.listByUser(user.id)
    return NextResponse.json({ ok: true, entries })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Watchlist persistence failed' }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })

  const body = await request.json() as {
    opportunityId?: string
    principalId?: string
    enabled?: boolean
  }
  const opportunityId = body.opportunityId?.trim()
  const principalId = body.principalId?.trim() || undefined
  if (!opportunityId) {
    return NextResponse.json({ ok: false, error: 'opportunityId is required' }, { status: 400 })
  }

  const entry: WatchlistEntry = {
    id: watchlistId(user.id, opportunityId, principalId),
    userId: user.id,
    opportunityId,
    principalId,
    enabled: body.enabled ?? true,
    createdAt: new Date().toISOString(),
  }

  try {
    const repository = new SupabaseWatchlistRepository()
    const saved = await repository.save(entry)
    return NextResponse.json({ ok: true, entry: saved }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Watchlist persistence failed' }, { status: 503 })
  }
}
