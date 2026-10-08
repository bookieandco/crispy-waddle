import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMoneyEventWindow,type MoneyMacroEvent} from './money-finish-event-calendar.js';

const event:MoneyMacroEvent={
  eventId:'cpi-1',jurisdiction:'US',eventKind:'ECONOMIC_RELEASE',affects:['USD','STOCK'],
  releaseAt:'2026-10-08T18:00:00Z',sourcePublishedAt:'2026-10-07T18:00:00Z',
  sourceAvailableAt:'2026-10-07T18:00:05Z',receivedAt:'2026-10-07T18:00:08Z',
  sourceType:'OFFICIAL',sourceEvidenceRefs:['agency:calendar'],provenanceHash:'macro:hash',
  status:'SCHEDULED',authority:'EVENT_EVIDENCE_ONLY'
};
const base={events:[event],coverage:'VERIFIED' as const,coverageEvidenceId:'agency:coverage',
  instrumentTags:['USD'],informationCutoff:'2026-10-08T17:55:00Z',
  preEventMs:10*60*1000,postEventMs:20*60*1000};
test('FINISH.06 scheduled official US release suspends FX research signals in blackout',()=>{
  const r=assessMoneyEventWindow(base);
  assert.equal(r.disposition,'NO_TRADE');
  assert.equal(r.canExecute,false);
  assert.deepEqual(r.affectedEventIds,['cpi-1']);
});
test('FINISH.06 unrelated and outside-window events do not create false blackout',()=>{
  assert.equal(assessMoneyEventWindow({...base,instrumentTags:['JPY']}).disposition,'ALLOW_RESEARCH');
  assert.equal(assessMoneyEventWindow({...base,informationCutoff:'2026-10-08T17:00:00Z'}).disposition,'ALLOW_RESEARCH');
  assert.equal(assessMoneyEventWindow({...base,coverage:'UNKNOWN'}).disposition,'DATA_BLOCKED');
});
test('FINISH.06 revised release requires time-stamped revision and post-event availability',()=>{
  assert.throws(()=>assessMoneyEventWindow({...base,events:[{...event,status:'REVISED'}]}),/REVISION_PROVENANCE_MISSING/);
  assert.throws(()=>assessMoneyEventWindow({...base,events:[{...event,status:'RELEASED'}]}),/EARLY_RELEASE_EVIDENCE_INVALID/);
  assert.throws(()=>assessMoneyEventWindow({...base,events:[{...event,sourceAvailableAt:'2026-10-09T00:00:00Z'}]}),/FUTURE_OR_UNAVAILABLE_EVENT/);
  assert.throws(()=>assessMoneyEventWindow({...base,events:[event,event]}),/EVENT_IDENTITY_INVALID/);
});
