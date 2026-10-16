import assert from 'node:assert/strict'
import { evaluateMemeStorageReadiness, type MemeStorageProbe } from './meme-storage-readiness.js'
const base = (): MemeStorageProbe => ({
  deployedProjectId: 'vercel:jhadina',
  configuredSupabaseProjectRef: 'verified-target',
  accessibleSupabaseProjectRefs: ['verified-target'],
  confirmedJhadinaProjectRef: 'verified-target',
  canonicalTables: ['jhadina_venture_records', 'jhadina_venture_candidate_adoptions'],
  migrationApplied: true, serviceProxyVerified: true, authenticatedOwnerCrudVerified: true,
  crossOwnerRejectionVerified: true, staleRevisionRejectionVerified: true,
  adoptionBoundaryVerified: true, observedAt: '2026-10-15T22:00:00.000Z',
})
const full=evaluateMemeStorageReadiness(base())
assert.equal(full.status,'READY_FOR_PAPER_ONLY')
assert.equal(full.permissionToApplyMigration,false)
assert.equal(full.permissionToMint,false)
assert.equal(full.permissionToTrade,false)
for (const key of [
  'migrationApplied','serviceProxyVerified','authenticatedOwnerCrudVerified','crossOwnerRejectionVerified',
  'staleRevisionRejectionVerified','adoptionBoundaryVerified',
] as const) {
  const b=base(); b[key]=false; assert.equal(evaluateMemeStorageReadiness(b).status,'BLOCKED',key)
}
assert.equal(evaluateMemeStorageReadiness({...base(),configuredSupabaseProjectRef:null}).status,'BLOCKED')
assert.equal(evaluateMemeStorageReadiness({...base(),confirmedJhadinaProjectRef:'pupson'}).status,'BLOCKED')
assert.equal(evaluateMemeStorageReadiness({...base(),accessibleSupabaseProjectRefs:['pupson','swlc']}).status,'BLOCKED')
assert.equal(evaluateMemeStorageReadiness({...base(),canonicalTables:[]}).status,'BLOCKED')
assert.throws(()=>evaluateMemeStorageReadiness({...base(),observedAt:'garbage'}),/INVALID/)
console.log('MEME-PROFIT.04–.06 commissioning checks passed')
