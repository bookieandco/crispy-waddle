import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewDatabaseRecoveryAdmission,EXPECTED_BUSINESS_TABLES} from './biz-purse-23-db-admission.mjs'
const proof={projectId:'kqbkaozfjubkjevdfvic',backupSha256:'a'.repeat(64),
 restoredArchiveSha256:'a'.repeat(64),schemaReadbackDigest:'b'.repeat(64),
 restoreSchemaDigest:'b'.repeat(64),operatorId:'alice',independentWitnessId:'bob',
 collisionVersions:[],tables:[...EXPECTED_BUSINESS_TABLES],rpcSearchPathsReviewed:true,
 rpcGrantsReviewed:true,canonicalReplayDigest:'digest',
 authenticatedRlsTests:EXPECTED_BUSINESS_TABLES.flatMap(table=>['OWNER_READ','CROSS_OWNER_DENIED','CLIENT_WRITE_DENIED'].map(caseId=>({table,caseId,passed:true})))}
test('matching self-reported restore evidence is review-only and never authorizes DDL',()=>{
 const r=reviewDatabaseRecoveryAdmission(proof)
 assert.equal(r.status,'INDEPENDENT_REVIEW_REQUIRED');assert.equal(r.canApplyMigration,false)
})
test('missing tables, unresolved collisions and denied test are blocked',()=>{
 const r=reviewDatabaseRecoveryAdmission({...proof,collisionVersions:['20261003221000'],
  tables:proof.tables.slice(0,3),authenticatedRlsTests:proof.authenticatedRlsTests.slice(0,8)})
 assert.equal(r.status,'BLOCKED')
 assert(r.reasons.includes('MIGRATION_VERSION_COLLISIONS'))
 assert(r.reasons.includes('RLS_MATRIX_INCOMPLETE'))
})
test('witness cannot self-approve',()=>{
 const r=reviewDatabaseRecoveryAdmission({...proof,independentWitnessId:'alice'})
 assert(r.reasons.includes('INDEPENDENT_RESTORE_WITNESS_REQUIRED'))
})
