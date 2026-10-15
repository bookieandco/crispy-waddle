import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {resolve,dirname,join} from 'node:path'
import {reconcileDbRecoverySnapshot,verifySnapshotSourceBytes} from './db-recover-01-08-reconcile.mjs'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const snapshot=JSON.parse(readFileSync(join(root,'docs/architecture/DB-RECOVER-SWLC-MIGRATION-SNAPSHOT.json'),'utf8'))
const deep=()=>structuredClone(snapshot)
test('real pinned repository snapshot has 223 SQL files and 8 historical collisions, no DDL authority',()=>{
 const r=reconcileDbRecoverySnapshot(snapshot)
 assert.equal(r.counts.localFiles,223)
 assert.equal(r.counts.remoteVersions,365)
 assert.equal(r.counts.collisionVersions,8)
 assert.equal(r.canApplySql,false)
 assert.deepEqual(r.unrecordedRequired,['20261002190000','20261003143000','20261003181500','20261003221000'])
 assert.equal(r.collisionRecorded.length,1)
 assert.equal(r.collisionRecorded[0].recordedName,'director_generation_submission_outbox')
})
test('all original migration bytes agree with tracked Git blob SHA1s',()=>{
 const r=verifySnapshotSourceBytes(snapshot,root)
 assert.equal(r.sourceBytesVerified,true)
 assert.equal(r.fileCount,223)
})
test('tampered path or mismatched manifest version cannot pass',()=>{
 const x=deep();x.localMigrations[0].path='../malicious.sql'
 assert.throws(()=>reconcileDbRecoverySnapshot(x),/LOCAL_MANIFEST_INVALID/)
 const y=deep();y.localMigrations[0].version='00000000000000'
 assert.throws(()=>reconcileDbRecoverySnapshot(y),/LOCAL_MANIFEST_INVALID/)
})
test('missing remote applied migration and fabricated repair flags cannot silently change disposition',()=>{
 const x=deep();x.recordedMigrations.pop()
 assert.throws(()=>reconcileDbRecoverySnapshot(x),/COLLISION_BASELINE_DRIFT|REMOTE_HISTORY_INVALID/) // if last version is a collision, baseline changes
})
test('an extra second migration with a previously unique version fails baseline integrity',()=>{
 const x=deep()
 const f=x.localMigrations.find(y=>y.version==='20261002190000')
 x.localMigrations.push({...f,path:'supabase/migrations/20261002190000_shadow_migration.sql',name:'shadow_migration'})
 assert.throws(()=>reconcileDbRecoverySnapshot(x),/COLLISION_BASELINE_DRIFT/)
})
test('required versions are tamper-proof and production authority stays false',()=>{
 const x=deep();x.requiredVersions.pop()
 assert.throws(()=>reconcileDbRecoverySnapshot(x),/REQUIRED_VERSIONS_TAMPERED/)
 const z=reconcileDbRecoverySnapshot(snapshot)
 assert.equal(z.productionCertified,false)
 assert.equal(z.independentBackupVerified,false)
 assert.equal(z.isolatedRestoreVerified,false)
})
