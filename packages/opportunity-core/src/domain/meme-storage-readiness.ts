/**
 * MEME-PROFIT.04–.06: storage commissioning checklist, never a migration runner.
 * Evidence is caller-provided; a missing/ambiguous verified target stays BLOCKED.
 */
export type MemeStorageProbe = {
  deployedProjectId: string
  configuredSupabaseProjectRef: string | null
  accessibleSupabaseProjectRefs: readonly string[]
  confirmedJhadinaProjectRef: string | null
  canonicalTables: readonly string[]
  migrationApplied: boolean
  serviceProxyVerified: boolean
  authenticatedOwnerCrudVerified: boolean
  crossOwnerRejectionVerified: boolean
  staleRevisionRejectionVerified: boolean
  adoptionBoundaryVerified: boolean
  observedAt: string
}
export type MemeStorageReadiness = {
  status: 'BLOCKED' | 'READY_FOR_PAPER_ONLY'
  gates: readonly { id: string; passed: boolean; reason: string }[]
  permissionToApplyMigration: false
  permissionToTrade: false
  permissionToMint: false
}
const canonical = ['jhadina_venture_records', 'jhadina_venture_candidate_adoptions'] as const

export function evaluateMemeStorageReadiness(probe: MemeStorageProbe): MemeStorageReadiness {
  if (!probe || !probe.deployedProjectId?.trim() || !Number.isFinite(Date.parse(probe.observedAt))) {
    throw Error('MEME_STORAGE_PROBE_INVALID')
  }
  const envRef = probe.configuredSupabaseProjectRef?.trim() || ''
  const confirmed = probe.confirmedJhadinaProjectRef?.trim() || ''
  const accessible = new Set(probe.accessibleSupabaseProjectRefs)
  const gates = [
    { id: 'target_identity', passed: !!envRef && !!confirmed && envRef === confirmed &&
      accessible.has(confirmed), reason: 'Same verified Supabase ref must appear in deployed config, owner confirmation, and accessible projects' },
    { id: 'venture_schema', passed: canonical.every(t => probe.canonicalTables.includes(t)),
      reason: 'Existing canonical Venture Factory tables must be present' },
    { id: 'paper_migration', passed: probe.migrationApplied === true,
      reason: 'Committed paper draft migration must be applied to the verified target only' },
    { id: 'server_identity', passed: probe.serviceProxyVerified === true,
      reason: 'Authenticated request identity + scoped service proxy must be verified' },
    { id: 'owner_crud', passed: probe.authenticatedOwnerCrudVerified === true,
      reason: 'Signed-in owner save, reopen, update and archive must be exercised against real DB' },
    { id: 'ownership', passed: probe.crossOwnerRejectionVerified === true,
      reason: 'A second owner must be refused across read/write/archive' },
    { id: 'concurrency', passed: probe.staleRevisionRejectionVerified === true,
      reason: 'Stale saves and stale archives must return a conflict' },
    { id: 'adoption', passed: probe.adoptionBoundaryVerified === true,
      reason: 'Unknown or unadopted Venture links must fail closed' },
  ] as const
  return {
    status: gates.every(g => g.passed) ? 'READY_FOR_PAPER_ONLY' : 'BLOCKED',
    gates,
    permissionToApplyMigration: false,
    permissionToTrade: false,
    permissionToMint: false,
  }
}
