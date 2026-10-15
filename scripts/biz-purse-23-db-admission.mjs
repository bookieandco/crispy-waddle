import {createHash} from 'node:crypto'
/** BIZ-PURSE.23: receipt consistency only, never a Supabase migration executor. */
export const EXPECTED_BUSINESS_TABLES=Object.freeze([
 'jhadina_side_hustle_work_orders','jhadina_side_hustle_commercial_receipts',
 'jhadina_side_hustle_commerce_records','jhadina_side_hustle_commissioning_evidence',
 'jhadina_digital_product_studio_records'
])
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)
export function reviewDatabaseRecoveryAdmission(input){
 if(!input||typeof input!=='object'||!Array.isArray(input.tables)||
  !Array.isArray(input.collisionVersions)||!Array.isArray(input.authenticatedRlsTests))
  throw Error('BIZ_PURSE_23_INPUT_INVALID')
 const reasons=[]
 if(input.projectId!=='kqbkaozfjubkjevdfvic')reasons.push('WRONG_SUPABASE_PROJECT')
 if(!sha(input.backupSha256)||!sha(input.restoredArchiveSha256)||
  input.backupSha256!==input.restoredArchiveSha256)reasons.push('BACKUP_RESTORE_ARCHIVE_MISMATCH')
 if(!sha(input.schemaReadbackDigest)||!sha(input.restoreSchemaDigest)||
  input.schemaReadbackDigest!==input.restoreSchemaDigest)reasons.push('ISOLATED_SCHEMA_RESTORE_NOT_PROVEN')
 if(!input.independentWitnessId||input.independentWitnessId===input.operatorId)
  reasons.push('INDEPENDENT_RESTORE_WITNESS_REQUIRED')
 if(input.collisionVersions.length)reasons.push('MIGRATION_VERSION_COLLISIONS')
 const names=new Set(input.tables)
 if(names.size!==input.tables.length)reasons.push('DUPLICATED_TABLE_CLAIMS')
 if(EXPECTED_BUSINESS_TABLES.some(x=>!names.has(x)))reasons.push('REQUIRED_COMMERCIAL_SCHEMA_MISSING')
 const testKeys=new Set()
 for(const t of input.authenticatedRlsTests){
  if(!t||typeof t.table!=='string'||typeof t.caseId!=='string'||!['OWNER_READ','CROSS_OWNER_DENIED','CLIENT_WRITE_DENIED'].includes(t.caseId)||
   t.passed!==true)reasons.push('TENANT_ISOLATION_TEST_FAILED')
  const key=t.table+':'+t.caseId
  if(testKeys.has(key))reasons.push('DUPLICATE_RLS_TEST')
  testKeys.add(key)
 }
 for(const table of EXPECTED_BUSINESS_TABLES){
  for(const kind of ['OWNER_READ','CROSS_OWNER_DENIED','CLIENT_WRITE_DENIED'])
   if(!testKeys.has(table+':'+kind))reasons.push('RLS_MATRIX_INCOMPLETE')
 }
 if(!input.rpcSearchPathsReviewed||!input.rpcGrantsReviewed||!input.canonicalReplayDigest)
  reasons.push('RPC_OR_CANONICAL_REPLAY_UNVERIFIED')
 return Object.freeze({status:reasons.length?'BLOCKED':'INDEPENDENT_REVIEW_REQUIRED',
  reasons:Object.freeze([...new Set(reasons)]),
  evidenceDigest:createHash('sha256').update(JSON.stringify(input)).digest('hex'),
  authority:'DATABASE_RECOVERY_INVENTORY_ONLY',canApplyMigration:false,
  canAlterProduction:false,productionCertified:false})
}
