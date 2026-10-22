import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPurseSelfFundReadiness, PURSE_REQUIRED_COMMERCIAL_TABLES} from './purse-self-fund-recovery-gate.mjs';

const present = PURSE_REQUIRED_COMMERCIAL_TABLES.map(table_name => ({
  table_name, exists_in_public: true, rls_enabled: true,
}));
const base = {observedAt:'2026-10-22T03:50:00.000Z', connectionReadOnly:'off',
  tableChecks:present, independentlyVerifiedBackupAndRestore:true,
  isolatedMigrationReplayPassed:true, crossTenantRlsTestPassed:true,
  ownerProductionApproval:true};

test('all purported checks still cannot authorize production financial changes', () => {
  const r=reviewPurseSelfFundReadiness(base);
  assert.equal(r.status,'OWNER_INDEPENDENT_REVIEW_REQUIRED');
  assert.equal(r.productionCertified,false);
  assert.equal(r.canApplyMigration,false);
  assert.equal(r.canMoveMoney,false);
});
test('missing commercial table keeps the migration blocked', () => {
  const r=reviewPurseSelfFundReadiness({...base,tableChecks:present.slice(1)});
  assert.equal(r.status,'BLOCKED');
  assert.deepEqual(r.missingCommercialTables,[PURSE_REQUIRED_COMMERCIAL_TABLES[0]]);
});
test('RLS gap on an existing table fails closed', () => {
  const r=reviewPurseSelfFundReadiness({...base,
    tableChecks:present.map((r,i)=>i===0?{...r,rls_enabled:false}:r)});
  assert.equal(r.status,'BLOCKED');
  assert.ok(r.blockers.includes('COMMERCIAL_RLS_MISSING'));
});
test('backup or rehearsal cannot be waived by owner approval', () => {
  const r=reviewPurseSelfFundReadiness({...base,
    independentlyVerifiedBackupAndRestore:false,isolatedMigrationReplayPassed:false});
  assert.equal(r.status,'BLOCKED');
  assert.ok(r.blockers.includes('INDEPENDENT_BACKUP_RESTORE_REQUIRED'));
  assert.ok(r.blockers.includes('ISOLATED_MIGRATION_REPLAY_REQUIRED'));
});
test('forged duplicate or malformed SQL results rejected', () => {
  assert.throws(()=>reviewPurseSelfFundReadiness({...base,tableChecks:[...present,present[0]]}),
    /DUPLICATE_OR_MALFORMED/);
  assert.throws(()=>reviewPurseSelfFundReadiness({...base,tableChecks:[{table_name:'x',rls_enabled:true}]}),
    /DUPLICATE_OR_MALFORMED/);
});
