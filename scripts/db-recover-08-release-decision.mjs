/**
 * DB-RECOVER.08: release inventory. A local manifest or self-declared backup
 * witness NEVER independently authorizes a production migration.
 */
import {reconcileDbRecoverySnapshot} from './db-recover-01-08-reconcile.mjs'
export const REQUIRED_TABLES=Object.freeze([
 'jhadina_side_hustle_work_orders','jhadina_side_hustle_commercial_receipts',
 'jhadina_side_hustle_commerce_records','jhadina_side_hustle_commissioning_evidence',
 'jhadina_digital_product_studio_records'])
export function evaluateDbRecoveryRelease({migrationSnapshot,liveReadback,backupReceipt=null,
 independentRestoreReceipt=null,ownerApprovedSqlHashes=[]}){
 const history=reconcileDbRecoverySnapshot(migrationSnapshot)
 if(!liveReadback||liveReadback.projectId!=='kqbkaozfjubkjevdfvic'||
  !Number.isFinite(Date.parse(liveReadback.observedAt))||
  !liveReadback.tables||typeof liveReadback.tables!=='object')
  throw Error('DB_RECOVER_08_READBACK_INVALID')
 const reasons=[]
 if(history.counts.collisionVersions>0)reasons.push('HISTORIC_MIGRATION_COLLISIONS_UNRESOLVED')
 if(history.counts.remoteOnly||history.counts.localOnly||history.counts.divergent)
  reasons.push('SOURCE_AND_RECORDED_HISTORY_UNRECONCILED')
 if(history.unrecordedRequired.length)reasons.push('CANONICAL_COMMERCIAL_MIGRATIONS_UNRECORDED')
 if(REQUIRED_TABLES.some(t=>liveReadback.tables[t]!==true))reasons.push('LIVE_COMMERCIAL_SCHEMA_MISSING')
 if(!backupReceipt||backupReceipt.status!=='BUNDLE_BYTES_MATCH_UNVERIFIED_SOURCE')
  reasons.push('BACKUP_BUNDLE_BYTES_UNVERIFIED')
 // A byte-matched bundle has no externally signed proof of source authenticity.
 reasons.push('SOURCE_BACKUP_AUTHENTICITY_UNVERIFIED')
 if(!independentRestoreReceipt||independentRestoreReceipt.independentRestoreVerified!==true)
  reasons.push('ISOLATED_RESTORE_NOT_INDEPENDENTLY_ATTESTED')
 // Uploaded attestations are untrusted inputs; no self-approval.
 reasons.push('RESTORE_ATTESTATION_REQUIRES_OUT_OF_BAND_REVIEW')
 if(!Array.isArray(ownerApprovedSqlHashes)||!ownerApprovedSqlHashes.length||
  ownerApprovedSqlHashes.some(x=>typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x)))
  reasons.push('REVIEWED_SQL_HASHES_AND_OWNER_AUTHORIZATION_MISSING')
 reasons.push('LIVE_RLS_TWO_OWNER_TEST_NOT_CERTIFIED')
 return Object.freeze({status:'BLOCKED',reasons:Object.freeze([...new Set(reasons)]),
  checkedAt:liveReadback.observedAt,projectId:liveReadback.projectId,
  sourceVersionCount:history.counts.uniqueLocalVersions,
  recordedVersionCount:history.counts.remoteVersions,
  collisionVersionCount:history.counts.collisionVersions,
  missingTables:Object.freeze(REQUIRED_TABLES.filter(t=>liveReadback.tables[t]!==true)),
  authority:'DB_RECOVER_RELEASE_INVENTORY_ONLY',
  canRunProductionDdl:false,canRepairHistory:false,canCommissionPayments:false,
  productionCertified:false})
}
