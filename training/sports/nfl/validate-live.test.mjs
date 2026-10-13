import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateLiveObservation} from './validate-live.mjs';

const p=JSON.parse(readFileSync(new URL('./2026/2026-10-12-buf-at-lar/pregame.case.json',import.meta.url),'utf8'));
const o=JSON.parse(readFileSync(new URL('./2026/2026-10-12-buf-at-lar/live.observation-001.json',import.meta.url),'utf8'));

test('checks actual stored provisional observation against original kickoff',()=>{
  const result=validateLiveObservation(p,o);
  assert.equal(result.valid,true);
  assert.equal(result.status,'PROVISIONAL_ONLY');
  assert.equal(result.score.BUF,3);
  assert.equal(result.score.LAR,0);
  assert.equal(result.trainingEligible,false);
});
test('rejects score fabricated before kickoff or before capture',()=>{
  assert.throws(()=>validateLiveObservation(p,{...o,as_of_utc:'2026-10-13T00:14:59Z'}),/LIVE_CLOCK_CONTRADICTION/);
  assert.throws(()=>validateLiveObservation(p,{...o,capture_utc:'2026-10-13T00:24:00Z'}),/LIVE_CLOCK_CONTRADICTION/);
});
test('rejects mismatched game, invalid score or invalid clock',()=>{
  assert.throws(()=>validateLiveObservation(p,{...o,event_id:'other'}),/LIVE_EVENT_MISMATCH/);
  assert.throws(()=>validateLiveObservation(p,{...o,provider_reported_score:{BUF:-1,LAR:0}}),/LIVE_SCORE_INVALID/);
  assert.throws(()=>validateLiveObservation(p,{...o,provider_reported_clock:{period:'Q6',remaining:'11:00'}}),/LIVE_CLOCK_INVALID/);
});
test('rejects attempted training, execution or forecast replacement',()=>{
  assert.throws(()=>validateLiveObservation(p,{...o,training_eligibility:'ALLOWED'}),/LIVE_TRAINING_ELIGIBILITY_INVALID/);
  assert.throws(()=>validateLiveObservation(p,{...o,governance:{...o.governance,canUpdateModelWeights:true}}),/LIVE_EVIDENCE_AUTHORITY_INVALID/);
});
