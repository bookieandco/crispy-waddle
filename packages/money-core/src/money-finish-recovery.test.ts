import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryPaperLedgerStore, createPaperLedgerEvent } from './paper-ledger.js';
import { verifyIsolatedPaperRestore } from './money-finish-recovery.js';
import type { PaperOrder } from './paper-execution-contracts.js';

const order:PaperOrder={
  paperOrderId:'paper-o-1',paperRunId:'shadow-1',executionPlanId:'plan',sliceId:'slice',instrumentId:'STOCK:TEST',
  side:'BUY',requestedNotional:{minor:1000n,currency:'USD'},instruction:'MARKETABLE_LIMIT',
  limitPriceMinor:100n,submittedAt:'2026-10-08T00:00:00Z',expiresAt:'2026-10-08T00:01:00Z',
  marketSnapshotId:'market-1',state:'OPEN',authority:'SIMULATION_ONLY'
};
const evt=createPaperLedgerEvent({paperRunId:'shadow-1',kind:'ORDER',payload:order});
const stores=()=>{const source=new InMemoryPaperLedgerStore(),restored=new InMemoryPaperLedgerStore();
  source.append(evt);restored.append(evt);return {source,restored};};
const base={paperRunId:'shadow-1',sourceIdentity:'volume:source',isolatedRestoreIdentity:'volume:isolate',
  sourceEvidenceIds:['source:readback'],isolatedReadbackEvidenceIds:['isolate:readback']};
test('FINISH.02 unavailable original fails closed without touching a store', async()=>{
  const r=await verifyIsolatedPaperRestore({paperRunId:'shadow-1',origin:'UNAVAILABLE'});
  assert.equal(r.status,'ORIGINAL_DATA_UNAVAILABLE');assert.equal(r.manifestHash,null);
});
test('FINISH.02 synthetic proof never certifies production data',async()=>{
  const r=await verifyIsolatedPaperRestore({...base,...stores(),origin:'SYNTHETIC'});
  assert.equal(r.rowCount,1);assert.match(r.manifestHash??'',/^[a-f0-9]{64}$/);
  assert.equal(r.status,'SYNTHETIC_REPLAY_ONLY');assert.equal(r.canAuthorizeLive,false);
});
test('FINISH.02 matching original-claimed rows still require external proof',async()=>{
  const r=await verifyIsolatedPaperRestore({...base,...stores(),origin:'ORIGINAL_PERSISTENT'});
  assert.equal(r.status,'CONTENT_MATCHED_EXTERNAL_CERTIFICATION_REQUIRED');
  assert.match(r.reasons[0]!,/HOST_DURABILITY/);
});
test('FINISH.02 rejects same store, missing receipts, empty and tampered event',async()=>{
  const {source,restored}=stores();
  await assert.rejects(()=>verifyIsolatedPaperRestore({...base,source,isolatedRestore:source,origin:'ORIGINAL_PERSISTENT'}),/INDEPENDENCE_REQUIRED/);
  await assert.rejects(()=>verifyIsolatedPaperRestore({...base,source,isolatedRestore:restored,sourceEvidenceIds:[],origin:'SYNTHETIC'}),/INDEPENDENCE_REQUIRED/);
  const empty = new InMemoryPaperLedgerStore();
  await assert.rejects(()=>verifyIsolatedPaperRestore({...base,source,isolatedRestore:empty,origin:'SYNTHETIC'}),/RESTORE_EMPTY/);
  const altered = new InMemoryPaperLedgerStore();
  altered.append(createPaperLedgerEvent({paperRunId:'shadow-1',kind:'ORDER',payload:{...order,limitPriceMinor:101n}}));
  await assert.rejects(()=>verifyIsolatedPaperRestore({...base,source,isolatedRestore:altered,origin:'SYNTHETIC'}),/HASH_OR_COUNT_MISMATCH/);
});
