import test from 'node:test'
import assert from 'node:assert/strict'
import {assessMigrationRecovery,inventoryLocalMigrations,REQUIRED_BIZ_PURSE_VERSIONS} from './biz-purse-14-migration-audit.mjs'
const at='2026-10-14T23:00:00Z'
const make=v=>({filename:v+'_side_hustle_work_orders.sql',content:'-- immutable test fixture '+v})
const local=REQUIRED_BIZ_PURSE_VERSIONS.map(make)
const recorded=local.map(f=>({version:f.filename.slice(0,14),name:f.filename.slice(15,-4)}))
const run=(overrides={})=>assessMigrationRecovery({local,recorded,requiredVersions:REQUIRED_BIZ_PURSE_VERSIONS,observedAt:at,...overrides})
test('all matching migrations still require separate manual replay and backup',()=>{
 const x=run()
 assert.equal(x.status,'MANUAL_REPLAY_REVIEW_REQUIRED')
 assert.equal(x.canApplyProductionMigrations,false)
 assert.equal(x.backupRestored,false)
})
test('duplicate canonical migration version blocks replay even when recorded once',()=>{
 const x=run({local:[...local,{filename:'20261003221000_director_timeline.sql',content:'-- another statement'}]})
 assert.equal(x.status,'BLOCKED')
 assert.equal(x.collisions[0].version,'20261003221000')
 assert(x.blockers.includes('DUPLICATE_LOCAL_MIGRATION_VERSION'))
})
test('missing required remote versions are explicitly reported',()=>{
 const x=run({recorded:recorded.slice(0,2)})
 assert.deepEqual(x.missingRequired,['20261003181500','20261003221000'])
 assert.equal(x.status,'BLOCKED')
})
test('missing canonical source and diverging remote names are blocked',()=>{
 assert(run({local:local.slice(0,3)}).blockers.includes('CANONICAL_REQUIRED_SQL_MISSING'))
 assert(run({recorded:[{...recorded[0],name:'another_migration'},...recorded.slice(1)]}).blockers.includes('RECORDED_NAME_DIFFERS_FROM_REPOSITORY'))
})
test('historical database migration absent from repo must be reconciled',()=>{
 const x=run({recorded:[...recorded,{version:'20260901000000',name:'external_history'}]})
 assert(x.untrackedHistory.includes('20260901000000'))
 assert(x.blockers.includes('DATABASE_MIGRATION_HISTORY_NOT_IN_REPOSITORY'))
})
test('local migration content is SHA256 fingerprinted, not executed',()=>{
 const a=inventoryLocalMigrations(local),b=inventoryLocalMigrations([{...local[0],content:'-- edited'},...local.slice(1)])
 assert.notEqual(a[0].sha256,b[0].sha256)
 assert.equal(a[0].sha256.length,64)
})
test('duplicate ledger versions and unsafe file identifiers fail',()=>{
 assert.throws(()=>run({recorded:[...recorded,recorded[0]]}),/RECORDED_MIGRATION_INVALID/)
 assert.throws(()=>inventoryLocalMigrations([{filename:'not-a-migration.sql',content:'x'}]),/BAD_OR_DUPLICATE_FILENAME/)
})
