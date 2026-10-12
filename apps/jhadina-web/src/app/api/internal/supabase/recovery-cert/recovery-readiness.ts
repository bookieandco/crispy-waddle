/**
 * SUPABASE-DB.2 / CROSS-SYSTEM.9: a read-only connectivity sweep can never
 * certify durable write authority, owner RLS, object-byte integrity or restore.
 *
 * This module has no path for accepting caller-supplied "approved" receipts:
 * all those missing gates require separately reviewed server-side evidence.
 */
export type ReadOnlyProbe = Readonly<{id:string;ready:boolean}>;

export type ReadOnlyRecoveryAssessment = Readonly<{
  ok:false
  ready:false
  canDeclareCrossSystemReady:false
  canMutate:false
  readOnlyProbesHealthy:boolean
  state:'BLOCKED'|'REVIEW_REQUIRED'
  certification:'NOT_ISSUED'
  blocker:'READ_ONLY_PROBE_FAILED'|'LIVE_WRITE_RESTORE_AND_OWNER_AUTH_PROOF_REQUIRED'
  missingEvidence:readonly string[]
}>

const REQUIRED_INDEPENDENT_EVIDENCE=Object.freeze([
  'SWLC_DISK_AND_WAL_HEADROOM',
  'SWLC_READ_WRITE_TRANSACTION',
  'POSTGREST_AUTHENTICATED_RLS_ALLOW_AND_DENY',
  'OWNER_AUTHENTICATED_SESSION_AND_DURABLE_READBACK',
  'ENCRYPTED_BACKUP_INDEPENDENT_ISOLATED_RESTORE',
  'STORAGE_OBJECT_BYTE_HASH_AND_READBACK',
  'WORKER_RESTART_AND_SCHEDULED_DELIVERY_RECEIPTS',
  'EXACT_DEPLOYMENT_SHA_AND_MIGRATION_RECONCILIATION',
] as const)

export function assessReadOnlyRecoveryProbes(
  probes:readonly ReadOnlyProbe[],
):ReadOnlyRecoveryAssessment{
  // An empty or missing batch must not be called healthy.
  const readOnlyProbesHealthy=probes.length>0&&probes.every(
    probe=>typeof probe.id==='string'&&probe.id.length>0&&probe.ready===true,
  )
  return Object.freeze({
    ok:false,
    ready:false,
    canDeclareCrossSystemReady:false,
    canMutate:false,
    readOnlyProbesHealthy,
    state:readOnlyProbesHealthy?'REVIEW_REQUIRED':'BLOCKED',
    certification:'NOT_ISSUED',
    blocker:readOnlyProbesHealthy
      ?'LIVE_WRITE_RESTORE_AND_OWNER_AUTH_PROOF_REQUIRED'
      :'READ_ONLY_PROBE_FAILED',
    missingEvidence:REQUIRED_INDEPENDENT_EVIDENCE,
  })
}
