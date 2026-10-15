import assert from 'node:assert/strict';
import test from 'node:test';
import {auditBusinessPurseSchema,REQUIRED_SCHEMA} from './biz-purse-readiness.mjs';
const fixture=()=>({
  observedAt:'2026-10-14T23:00:00Z',
  migrations:[...new Set(REQUIRED_SCHEMA.map(x=>x.migration))],
  relations:Object.fromEntries(REQUIRED_SCHEMA.map(x=>[x.table,true])),
  functions:Object.fromEntries(REQUIRED_SCHEMA.map(x=>[x.function,true])),
  rls:Object.fromEntries(REQUIRED_SCHEMA.map(x=>[x.table,true])),
});
test('blocks a completely missing commercial schema',()=>{
  const base=fixture();base.migrations=[];base.relations={};base.functions={};base.rls={};
  const report=auditBusinessPurseSchema(base);
  assert.equal(report.status,'BLOCKED');
  assert(report.issues.some(i=>i.code==='MIGRATION_MISSING'));
  assert.equal(report.moneyMovementAuthorized,false);
});
test('missing one RPC fails closed with migration present',()=>{
  const base=fixture();base.functions[REQUIRED_SCHEMA[0].function]=false;
  const report=auditBusinessPurseSchema(base);
  assert(report.issues.some(i=>i.code==='RPC_MISSING'));
  assert(report.issues.some(i=>i.code==='SCHEMA_DRIFT'));
});
test('RLS disabled fails closed',()=>{
  const base=fixture();base.rls[REQUIRED_SCHEMA[0].table]=false;
  assert(auditBusinessPurseSchema(base).issues.some(i=>i.code==='RLS_DISABLED'));
});
test('all schema checks present is review only, never certification',()=>{
  const report=auditBusinessPurseSchema(fixture());
  assert.equal(report.status,'READY_FOR_SECURITY_AND_RESTORE_REVIEW');
  assert.equal(report.productionCertified,false);
  assert.equal(report.externalActionAuthorized,false);
});
test('invalid, partial, and stale timestamp evidence are rejected or blocked',()=>{
  assert.throws(()=>auditBusinessPurseSchema({}),/PROBE_INCOMPLETE/);
  const base=fixture();base.observedAt='not-a-time';
  assert(auditBusinessPurseSchema(base).issues.some(i=>i.code==='TIMESTAMP_MISSING'));
});
