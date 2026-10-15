import test from 'node:test'
import assert from 'node:assert/strict'
import {inspectRecoveryPreflight} from './db-recover-01-history-preflight.mjs'
const file=(version,name)=>({name:version+'_'+name+'.sql',body:'-- '+name})
const sample={files:[file('20261002190000','business'),file('20261003221000','digital')],
 applied:[{version:'20261002190000',name:'business'}],requiredVersions:['20261002190000','20261003221000'],
 observedAt:'2026-10-15T04:00:00Z'}
test('missing required commercial migration blocks any production action',()=>{
 const r=inspectRecoveryPreflight(sample)
 assert.equal(r.status,'BLOCKED');assert.equal(r.canApplyProductionMigration,false)
 assert(r.reasons.includes('REQUIRED_MIGRATIONS_NOT_APPLIED'))
})
test('version collision including required migration cannot be bypassed',()=>{
 const r=inspectRecoveryPreflight({...sample,files:[...sample.files,file('20261003221000','director')]})
 assert(r.reasons.includes('MIGRATION_VERSION_COLLISIONS'))
 assert(r.reasons.includes('REQUIRED_VERSION_NOT_UNIQUE'))
})
test('unexpected deployed migration and name drift are independently blocking',()=>{
 const r=inspectRecoveryPreflight({...sample,applied:[{version:'20261002190000',name:'different'},
 {version:'20260901000000',name:'unknown'}]})
 assert(r.reasons.includes('APPLIED_HISTORY_UNMATCHED'))
 assert(r.reasons.includes('APPLIED_MIGRATION_NAME_DRIFT'))
})
test('duplicate remote history and malformed input are rejected',()=>{
 assert.throws(()=>inspectRecoveryPreflight({...sample,applied:[sample.applied[0],sample.applied[0]]}),/HISTORY_UNTRUSTED/)
 assert.throws(()=>inspectRecoveryPreflight({...sample,files:[{name:'unsafe.sql',body:'x'}]}),/LOCAL_FILE_INVALID/)
})
test('even matched manifest has no authority to certify restoration',()=>{
 const r=inspectRecoveryPreflight({...sample,applied:[
 {version:'20261002190000',name:'business'},{version:'20261003221000',name:'digital'}]})
 assert.equal(r.status,'INDEPENDENT_REVIEW_REQUIRED');assert.equal(r.backupRestored,false)
 assert.equal(r.canMarkMigrationsApplied,false)
})
