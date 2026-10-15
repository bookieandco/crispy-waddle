import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {evaluateDbRecoveryRelease,REQUIRED_TABLES} from './db-recover-08-release-decision.mjs'
const snapshot=JSON.parse(readFileSync(new URL('../docs/architecture/DB-RECOVER-SWLC-MIGRATION-SNAPSHOT.json',import.meta.url),'utf8'))
const readback=JSON.parse(readFileSync(new URL('../docs/architecture/DB-RECOVER-SWLC-READBACK-20261015.json',import.meta.url),'utf8'))
const run=(overrides={})=>evaluateDbRecoveryRelease({migrationSnapshot:snapshot,liveReadback:readback,...overrides})
test('actual live readback lacks all five tables, with collisions and four missing versions',()=>{
 const r=run();assert.equal(r.status,'BLOCKED')
 assert.equal(r.missingTables.length,5)
 assert.equal(r.collisionVersionCount,8)
 assert.equal(r.canRunProductionDdl,false)
 assert(r.reasons.includes('CANONICAL_COMMERCIAL_MIGRATIONS_UNRECORDED'))
})
test('forged all-present snapshot and claimed restoration cannot authorize production DDL',()=>{
 const fake={...readback,tables:Object.fromEntries(REQUIRED_TABLES.map(x=>[x,true]))}
 const r=run({liveReadback:fake,backupReceipt:{status:'BUNDLE_BYTES_MATCH_UNVERIFIED_SOURCE'},
  independentRestoreReceipt:{independentRestoreVerified:true},ownerApprovedSqlHashes:['a'.repeat(64)]})
 assert.equal(r.status,'BLOCKED');assert.equal(r.productionCertified,false)
 assert(r.reasons.includes('SOURCE_BACKUP_AUTHENTICITY_UNVERIFIED'))
 assert(r.reasons.includes('LIVE_RLS_TWO_OWNER_TEST_NOT_CERTIFIED'))
})
test('wrong project or incomplete readback not silently admitted',()=>{
 assert.throws(()=>run({liveReadback:{...readback,projectId:'other'}}),/READBACK_INVALID/)
})
