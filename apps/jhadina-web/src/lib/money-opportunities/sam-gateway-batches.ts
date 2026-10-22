import type { SupabaseClient } from '@supabase/supabase-js'

// The deployed SAM gateway rejects mutation payloads over 5,000,000 UTF-8
// bytes. Leave transport/envelope headroom instead of weakening that boundary.
export const SAM_GATEWAY_MUTATION_BYTE_BUDGET = 4_000_000
export const SAM_GATEWAY_MUTATION_ROW_BUDGET = 200

type SamTable = 'jhadina_sam_catalog' | 'jhadina_sam_versions'
type UpsertOptions = { onConflict: string; ignoreDuplicates?: boolean }
const utf8 = new TextEncoder()

/** Plan every batch before the first write; a too-large single row fails closed. */
export function splitSamGatewayUpserts<T extends Record<string, unknown>>(
  table: SamTable,
  records: readonly T[],
  options: UpsertOptions,
): T[][] {
  if (records.length === 0) return []
  const envelopeBytes = utf8.encode(JSON.stringify({
    action: 'db',
    request: { table, filters: [], method: 'upsert', payload: [], options },
  })).byteLength
  const batches: T[][] = []
  let batch: T[] = []
  let bytes = envelopeBytes

  for (const record of records) {
    const json = JSON.stringify(record)
    if (typeof json !== 'string') throw new Error('SAM_GATEWAY_UNSERIALIZABLE_ROW')
    const rowBytes = utf8.encode(json).byteLength
    if (envelopeBytes + rowBytes > SAM_GATEWAY_MUTATION_BYTE_BUDGET) {
      throw new Error(`SAM_GATEWAY_SINGLE_ROW_EXCEEDS_BUDGET:${table}`)
    }
    if (batch.length > 0 && (
      batch.length >= SAM_GATEWAY_MUTATION_ROW_BUDGET ||
      bytes + 1 + rowBytes > SAM_GATEWAY_MUTATION_BYTE_BUDGET
    )) {
      batches.push(batch)
      batch = []
      bytes = envelopeBytes
    }
    bytes += rowBytes + (batch.length ? 1 : 0)
    batch.push(record)
  }
  if (batch.length) batches.push(batch)
  return batches
}

/**
 * Keep the catalog-first order: jhadina_sam_versions references the catalog.
 * Both payload families are preflighted before mutation; errors never succeed
 * silently. Unchanged notice/version semantics remain owned by sam-wide-runtime.
 */
export async function persistSamCatalogBatches(
  client: SupabaseClient,
  catalogRows: Record<string, unknown>[],
  versionRows: Record<string, unknown>[],
): Promise<void> {
  const catalogOptions = { onConflict: 'notice_id' }
  const versionOptions = { onConflict: 'notice_id,checksum', ignoreDuplicates: true }
  const catalogs = splitSamGatewayUpserts('jhadina_sam_catalog', catalogRows, catalogOptions)
  const versions = splitSamGatewayUpserts('jhadina_sam_versions', versionRows, versionOptions)

  for (const batch of catalogs) {
    const { error } = await client.from('jhadina_sam_catalog').upsert(batch, catalogOptions)
    if (error) throw new Error(`Unable to persist SAM catalog: ${error.message}`)
  }
  for (const batch of versions) {
    const { error } = await client.from('jhadina_sam_versions').upsert(batch, versionOptions)
    if (error) throw new Error(`Unable to persist SAM versions: ${error.message}`)
  }
}
