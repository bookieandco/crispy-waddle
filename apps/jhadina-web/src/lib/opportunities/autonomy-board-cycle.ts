import { discoverPublicBoard, type BoardInput } from './public-job-board'
import type { Opportunity } from '@jhadina/opportunity-core'
import { makeDiscoveredJobReview, type DiscoveredJobReview } from './job-import-acceptance'

export type BoundedBoardCycleInput = {
  sources: BoardInput[]
  mode: 'preview' | 'owner_import'
  ownerAuthenticated: boolean
  maxPerBoard?: number
}
export type PublicBoardCycleResult = {
  scanned: number
  fetched: number
  persisted: number
  failed: string[]
  opportunityIds: string[]
  previews: DiscoveredJobReview[]
  verifiedImports: number
  applicationAuthorized: false
  eligibleForUnattendedSchedule: false
  outboundMessagesSent: 0
  status: 'preview' | 'owner_import_completed' | 'partially_failed'
}
export type BoardCycleDeps = {
  discover: typeof discoverPublicBoard
  ingest: (record: Opportunity) => Promise<{ id: string; verified?: boolean }>
}

/**
 * OCE-AUTONOMY.LIVE.07 — a bounded, owner-initiated research cycle.
 * No unsolicited scheduled polling until independent scope + provider policy commissioning.
 * Partial failures are explicit; no fake success or inferred job eligibility.
 */
export async function runBoundedBoardCycle(input: BoundedBoardCycleInput, deps: BoardCycleDeps): Promise<PublicBoardCycleResult> {
  if (!input.ownerAuthenticated) throw new Error('Authenticated owner required')
  if (input.mode !== 'preview' && input.mode !== 'owner_import') throw new Error('Invalid discovery mode')
  if (!Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > 5) throw new Error('Bounded cycle requires 1-5 boards')
  const ids = new Set<string>()
  const keys = new Set<string>()
  const failed: string[] = []
  let scanned = 0
  let fetched = 0
  let persisted = 0
  let verifiedImports = 0
  const previews: DiscoveredJobReview[]=[]
  for (const raw of input.sources) {
    if (!['greenhouse','lever'].includes(raw.source) || !/^[a-z0-9][a-z0-9_-]{1,49}$/i.test(raw.board)) throw new Error('Unapproved board token')
    const key = raw.source + ':' + raw.board.toLowerCase()
    if (keys.has(key)) continue
    keys.add(key)
    scanned++
    try {
      const result = await deps.discover({ source:raw.source,board:raw.board,limit:Math.min(Math.max(input.maxPerBoard ?? 25,1),25) })
      for (const opportunity of result.opportunities) {
        fetched++
        if (ids.has(opportunity.id)) continue
        ids.add(opportunity.id)
        previews.push(makeDiscoveredJobReview(opportunity))
        if (input.mode === 'owner_import') {
          const accepted = await deps.ingest(opportunity)
          if (accepted.id !== opportunity.id) throw new Error('Canonical repository returned mismatched identity')
          persisted++
          if(accepted.verified===true) verifiedImports++
        }
      }
    } catch (error) {
      failed.push(key + ': ' + (error instanceof Error ? error.message : 'UNAVAILABLE'))
    }
  }
  return {
    scanned, fetched, persisted, verifiedImports, previews, failed, opportunityIds:[...ids],
    applicationAuthorized:false,eligibleForUnattendedSchedule:false,outboundMessagesSent:0,
    status:failed.length ? 'partially_failed' : input.mode === 'preview' ? 'preview' : 'owner_import_completed',
  }
}
