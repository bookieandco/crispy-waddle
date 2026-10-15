/**
 * BIZ-PURSE.14: local-byte backup evidence review; no remote connections.
 * Passing this consistency check is NOT proof that Postgres can be restored.
 */
import {createHash} from 'node:crypto'
import {readFileSync,statSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const validSha=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s)
const validTime=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))
export function assessBizPurseBackupEvidence(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('BIZ_PURSE_14_BACKUP_INPUT_INVALID')
 const {backup,restore,actualArchiveBytes}=input
 if(!backup||typeof backup!=='object'||!restore||typeof restore!=='object')throw new Error('BIZ_PURSE_14_MANIFEST_INCOMPLETE')
 const reasons=[]
 if(backup.sourceProjectId!=='kqbkaozfjubkjevdfvic')reasons.push('SOURCE_PROJECT_NOT_SWLC')
 if(!validSha(backup.sha256)||!Number.isSafeInteger(backup.bytes)||backup.bytes<=0||!validTime(backup.capturedAt))reasons.push('BACKUP_METADATA_INVALID')
 if(!actualArchiveBytes||!(actualArchiveBytes instanceof Uint8Array)||actualArchiveBytes.length===0)reasons.push('INDEPENDENT_ARCHIVE_BYTES_NOT_READ')
 if(actualArchiveBytes instanceof Uint8Array){
  if(backup.sha256!==sha(actualArchiveBytes)||backup.bytes!==actualArchiveBytes.byteLength)reasons.push('ARCHIVE_HASH_OR_LENGTH_MISMATCH')
 }
 if(restore.targetKind!=='DISPOSABLE_LOCAL_POSTGRES'||!/^biz_purse_recovery_[a-z0-9_]+$/.test(restore.databaseName??'')||
    !['localhost','127.0.0.1','::1'].includes(restore.databaseHost))reasons.push('RESTORE_TARGET_NOT_DISPOSABLE')
 if(!validTime(restore.restoredAt)||!validSha(restore.schemaDigestSha256)||!validSha(restore.readbackDigestSha256))reasons.push('RESTORE_EVIDENCE_INCOMPLETE')
 if(restore.schemaDigestSha256!==restore.readbackDigestSha256)reasons.push('RESTORE_SCHEMA_READBACK_MISMATCH')
 if(!restore.operatorId||!restore.independentWitnessId||restore.operatorId===restore.independentWitnessId)reasons.push('INDEPENDENT_RESTORE_WITNESS_MISSING')
 if(!restore.restoreCommandReceiptId||!restore.sqlReadbackReceiptId)reasons.push('RESTORE_COMMAND_OR_READBACK_RECEIPT_MISSING')
 if(validTime(backup.capturedAt)&&validTime(restore.restoredAt)&&Date.parse(restore.restoredAt)<Date.parse(backup.capturedAt))reasons.push('RESTORE_BEFORE_BACKUP')
 return Object.freeze({
  status:reasons.length?'BLOCKED':'INDEPENDENT_RESTORE_REVIEW_REQUIRED',
  blockers:Object.freeze(reasons),archiveSha256:actualArchiveBytes instanceof Uint8Array?sha(actualArchiveBytes):null,
  sourceProject:backup.sourceProjectId??null,
  databaseName:restore.databaseName??null,
  verifiedRestoration:false, // a manifest/attestation never verifies the running DB by itself
  productionMigrationAuthorized:false,
  authority:'BACKUP_EVIDENCE_REVIEW_ONLY'
 })
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const manifestPath=process.argv[2],archivePath=process.argv[3]
 if(!manifestPath||!archivePath){console.error('Usage: node scripts/biz-purse-14-backup-review.mjs <receipt.json> <local-backup-file>');process.exitCode=2}
 else try {
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8'))
  const archive=readFileSync(archivePath)
  const result=assessBizPurseBackupEvidence({...manifest,actualArchiveBytes:archive})
  console.log(JSON.stringify(result,null,2))
  if(result.status==='BLOCKED')process.exitCode=1
 }catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=2}
}
