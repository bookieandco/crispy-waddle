import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=new URL('../docs/architecture/DB-RECOVER-SWLC-COLLISION-OBJECT-SNAPSHOT.json',import.meta.url)
const sql=new URL('./db-recover-04-collision-object-probe.sql',import.meta.url)
const proof=JSON.parse(readFileSync(source,'utf8'))
test('source-pinned collision canary covers 16 distinct objects with mixed provenance',()=>{
 assert.equal(proof.candidates.length,16)
 assert.equal(new Set(proof.candidates.map(x=>x.file)).size,16)
 assert.equal(proof.candidates.filter(x=>x.present).length,8)
 assert.equal(proof.candidates.filter(x=>!x.present).length,8)
 assert.equal(proof.objectExistenceDoesNotProveMigrationExecution,true)
 assert.equal(proof.productionMigrationAuthorized,false)
})
test('both sides of one recorded collision have objects; historical version is insufficient proof',()=>{
 const pair=proof.candidates.filter(x=>x.file.startsWith('20260902013135_'))
 assert.equal(pair.length,2)
 assert(pair.every(x=>x.present))
})
test('the companion query contains read-only catalog lookups, no modification',()=>{
 const query=readFileSync(sql,'utf8')
 assert.match(query,/with probes/i)
 assert.match(query,/select jsonb_build_object/i)
 assert.match(query,/to_regclass/i)
 assert.doesNotMatch(query,/^\s*(?:insert|update|delete|alter|create|drop|truncate|grant|revoke|call|do)\b/im)
})
