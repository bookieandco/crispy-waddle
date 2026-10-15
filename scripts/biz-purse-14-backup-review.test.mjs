import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {assessBizPurseBackupEvidence} from './biz-purse-14-backup-review.mjs'
const archive=Buffer.from('fixture-only-never-an-actual-production-backup')
const digest=x=>createHash('sha256').update(x).digest('hex')
const make=()=>({
 backup:{sourceProjectId:'kqbkaozfjubkjevdfvic',sha256:digest(archive),bytes:archive.byteLength,capturedAt:'2026-10-14T21:00:00Z'},
 restore:{targetKind:'DISPOSABLE_LOCAL_POSTGRES',databaseName:'biz_purse_recovery_canary',databaseHost:'127.0.0.1',
 restoredAt:'2026-10-14T22:00:00Z',schemaDigestSha256:'a'.repeat(64),readbackDigestSha256:'a'.repeat(64),
 operatorId:'operator-a',independentWitnessId:'operator-b',restoreCommandReceiptId:'restore:1',sqlReadbackReceiptId:'query:1'},
 actualArchiveBytes:archive
})
test('consistent backup and restore claims require independent external review',()=>{
 const result=assessBizPurseBackupEvidence(make())
 assert.equal(result.status,'INDEPENDENT_RESTORE_REVIEW_REQUIRED')
 assert.equal(result.verifiedRestoration,false)
 assert.equal(result.productionMigrationAuthorized,false)
})
test('real local archive bytes must match size and SHA-256',()=>{
 let x=make();x.actualArchiveBytes=Buffer.from('different')
 assert(assessBizPurseBackupEvidence(x).blockers.includes('ARCHIVE_HASH_OR_LENGTH_MISMATCH'))
})
test('no backup bytes fails even with a convincing manifest',()=>{
 let x=make();delete x.actualArchiveBytes
 assert(assessBizPurseBackupEvidence(x).blockers.includes('INDEPENDENT_ARCHIVE_BYTES_NOT_READ'))
})
test('remote or ambiguous restore database names fail',()=>{
 let x=make();x.restore.databaseHost='production.example.com'
 assert(assessBizPurseBackupEvidence(x).blockers.includes('RESTORE_TARGET_NOT_DISPOSABLE'))
 x=make();x.restore.databaseName='postgres'
 assert(assessBizPurseBackupEvidence(x).blockers.includes('RESTORE_TARGET_NOT_DISPOSABLE'))
})
test('one person self-attesting a restore or missing readback blocks',()=>{
 let x=make();x.restore.independentWitnessId=x.restore.operatorId
 assert(assessBizPurseBackupEvidence(x).blockers.includes('INDEPENDENT_RESTORE_WITNESS_MISSING'))
 x=make();x.restore.sqlReadbackReceiptId=''
 assert(assessBizPurseBackupEvidence(x).blockers.includes('RESTORE_COMMAND_OR_READBACK_RECEIPT_MISSING'))
})
test('schema readback hash mismatch blocks',()=>{
 let x=make();x.restore.readbackDigestSha256='b'.repeat(64)
 assert(assessBizPurseBackupEvidence(x).blockers.includes('RESTORE_SCHEMA_READBACK_MISMATCH'))
})

test('streamed byte digest observations are accepted without in-memory archive bytes',()=>{
 const input=make();delete input.actualArchiveBytes
 input.observedArchive={sha256:digest(archive),bytes:archive.byteLength}
 const r=assessBizPurseBackupEvidence(input)
 assert.equal(r.status,'INDEPENDENT_RESTORE_REVIEW_REQUIRED')
 assert.equal(r.verifiedRestoration,false)
})
