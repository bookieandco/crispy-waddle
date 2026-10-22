import type { SupabaseClient } from '@supabase/supabase-js'
import { checksumSamNotice, normalizeSamWideNotice } from '@jhadina/opportunity-core'
import { persistSamCatalogBatches } from './sam-gateway-batches'

export type SamCatalogIdentity = { notice_id: string; checksum: string; version: number }
export type SamStoredCatalog = SamCatalogIdentity & {
  raw: Record<string, unknown>
  source_url: string
  last_seen_at: string
}
export type SamHistoryIdentity = SamCatalogIdentity
type HistorySnapshot = { notice_id: string; version: number; checksum: string; snapshot: Record<string, unknown>; captured_at: string }
const safeRows = (data: unknown): Record<string, unknown>[] =>
  Array.isArray(data) ? data.filter((value): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))) : []
const versionKey = (id: string, version: number) => JSON.stringify([id, version])

function validOfficialSource(value: string): boolean {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && (host === 'sam.gov' || host.endsWith('.sam.gov'))
  } catch {
    return false
  }
}

/**
 * Pure, fail-closed reconstruction from durable catalog source material.
 * NEVER create a historical snapshot from an arbitrary caller-provided checksum:
 * rehash the stored raw official SAM record and verify both identity and version.
 * Existing history, once written, is not overwritten.
 */
export function planSamHistoryRepairs(
  missing: readonly SamStoredCatalog[],
): HistorySnapshot[] {
  const repairs: HistorySnapshot[] = []
  const ids = new Set<string>()
  for (const row of missing) {
    if (!row || typeof row.notice_id !== 'string' || !row.notice_id ||
      ids.has(row.notice_id) || !Number.isSafeInteger(row.version) || row.version < 1 ||
      typeof row.checksum !== 'string' || !/^[a-f0-9]{64}$/i.test(row.checksum) ||
      !row.raw || typeof row.raw !== 'object' || Array.isArray(row.raw) ||
      typeof row.source_url !== 'string' || !validOfficialSource(row.source_url) ||
      typeof row.last_seen_at !== 'string' || !Number.isFinite(Date.parse(row.last_seen_at))
    ) throw new Error('SAM_HISTORY_REPAIR_UNTRUSTED_CATALOG_EVIDENCE')
    ids.add(row.notice_id)
    const normalized = normalizeSamWideNotice(row.raw, row.last_seen_at)
    if (normalized.noticeId !== row.notice_id ||
        checksumSamNotice(row.raw) !== row.checksum) {
      throw new Error('SAM_HISTORY_REPAIR_CHECKSUM_OR_IDENTITY_MISMATCH')
    }
    // last_seen_at is the persisted source-observation time; no original
    // version-creation time is invented for interrupted historical writes.
    repairs.push({
      notice_id: row.notice_id,
      version: row.version,
      checksum: row.checksum,
      snapshot: row.raw,
      captured_at: row.last_seen_at,
    })
  }
  return repairs
}

/**
 * Source-only reconciliation contract for the SAME catalog records observed
 * by a legitimate running scanner. Defaults to inspect mode; no production
 * write happens unless the authorized scanner explicitly opts into repair.
 *
 * At most 250 records per call; version matches are complete or fail closed.
 * The gateway permits only constrained table/column operations.
 */
export async function reconcileSamObservedHistory(
  client: SupabaseClient,
  observed: readonly SamCatalogIdentity[],
  options: { write?: boolean } = {},
): Promise<{ missing: number; repaired: number }> {
  if (!observed.length) return { missing: 0, repaired: 0 }
  if (observed.length > 250) throw new Error('SAM_HISTORY_REPAIR_TOO_MANY_NOTICES')
  const idSet = new Set<string>()
  const versions = new Set<number>()
  for (const row of observed) {
    if (!row || typeof row.notice_id !== 'string' || !row.notice_id ||
      idSet.has(row.notice_id) || !Number.isSafeInteger(row.version) || row.version < 1 ||
      typeof row.checksum !== 'string' || !/^[a-f0-9]{64}$/i.test(row.checksum)
    ) throw new Error('SAM_HISTORY_REPAIR_INVALID_IDENTITY')
    idSet.add(row.notice_id)
    versions.add(row.version)
  }

  const ids = [...idSet]
  const history = await client.from('jhadina_sam_versions')
    .select('notice_id,version,checksum', { count: 'exact' })
    .in('notice_id', ids)
    .in('version', [...versions])
    .limit(5000)
  if (history.error) throw new Error(`SAM_HISTORY_REPAIR_READ_FAILED:${history.error.message}`)
  const found = safeRows(history.data)
  if (history.count === null || history.count !== found.length || found.length >= 5000) {
    throw new Error('SAM_HISTORY_REPAIR_HISTORY_TRUNCATED')
  }
  const byVersion = new Map<string, string>()
  for (const row of found) {
    const id = String(row.notice_id ?? '')
    const version = Number(row.version)
    const checksum = String(row.checksum ?? '')
    const key = versionKey(id, version)
    if (byVersion.has(key) && byVersion.get(key) !== checksum) {
      throw new Error('SAM_HISTORY_REPAIR_CONFLICTING_HISTORY')
    }
    byVersion.set(key, checksum)
  }

  const missing = observed.filter(row => {
    const prior = byVersion.get(versionKey(row.notice_id, row.version))
    if (prior !== undefined && prior !== row.checksum) {
      throw new Error('SAM_HISTORY_REPAIR_VERSION_COLLISION')
    }
    return prior === undefined
  })
  if (!missing.length) return { missing: 0, repaired: 0 }

  const stored = await client.from('jhadina_sam_catalog')
    .select('notice_id,version,checksum,raw,source_url,last_seen_at', { count: 'exact' })
    .in('notice_id', missing.map(row => row.notice_id))
    .limit(250)
  if (stored.error) throw new Error(`SAM_HISTORY_REPAIR_CATALOG_READ_FAILED:${stored.error.message}`)
  const candidates = safeRows(stored.data)
  if (stored.count !== missing.length || candidates.length !== missing.length) {
    throw new Error('SAM_HISTORY_REPAIR_CATALOG_INCOMPLETE')
  }
  const candidateById = new Map(candidates.map(row => [String(row.notice_id), row]))
  const verified: SamStoredCatalog[] = []
  for (const expected of missing) {
    const row = candidateById.get(expected.notice_id)
    if (!row || row.version !== expected.version || row.checksum !== expected.checksum) {
      throw new Error('SAM_HISTORY_REPAIR_CATALOG_CHANGED')
    }
    verified.push(row as SamStoredCatalog)
  }
  const planned = planSamHistoryRepairs(verified)
  if (options.write === true) {
    // Insert existing catalog's missing version BEFORE any new catalog updates.
    // Upsert ignoreDuplicates prevents rewriting actual historical observations.
    await persistSamCatalogBatches(client, [], planned)
  }
  return { missing: planned.length, repaired: options.write === true ? planned.length : 0 }
}
