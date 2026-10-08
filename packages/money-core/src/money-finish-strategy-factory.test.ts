import test from 'node:test';
import assert from 'node:assert/strict';
import {registerMoneyStrategy,assertMoneyStrategyCandidate,MoneyStrategyTrialLedger,
  MoneyInProcessHoldoutLockbox,type MoneyHoldoutCase,type MoneyDevelopmentTrial
} from './money-finish-strategy-factory.js';

const candidateInput={
  candidateId:'fx-dev-1',strategyFamily:'FX_SUPERVISED' as const,
  asset:'FOREX' as const,instrumentId:'fx:EURUSD',methodologyVersion:'candidate-v1',
  sourceSchema:'MONEY-FINISH-10',sourceEvidenceIds:['fx-ml:study', 'source:licensed'],
  informationCutoff:'2026-09-29T12:00:00Z',createdAt:'2026-09-30T12:00:00Z',
  parameters:{lookback:20, spreadLimit:2.5, shortAllowed:false},
  maximumDevelopmentTrials:2
};
const candidate=registerMoneyStrategy(candidateInput);
const trial:Omit<MoneyDevelopmentTrial,'authority'|'canExecute'|'canAuthorizeLive'>={
  trialId:'development:1',candidateId:candidate.candidateId,
  candidateHash:candidate.candidateHash,datasetSnapshotHash:'development:dataset:hash',
  datasetPartition:'DEVELOPMENT',lastOutcomeAvailableAt:'2026-10-01T08:00:00Z',
  evaluatedAt:'2026-10-01T10:00:00Z',sampleSize:80,grossReturnBps:200,
  totalCostBps:40,netReturnBps:160,maxDrawdownBps:120,
  evidenceIds:['dev:receipt','cost:model']
};
const rows:MoneyHoldoutCase[]=[
  {caseId:'hold:1',decisionAt:'2026-10-03T12:00:00Z',
    outcomeAt:'2026-10-03T13:00:00Z',outcomeAvailableAt:'2026-10-03T13:05:00Z',
    realizedReturnBps:30,oneWayCostBps:2,evidenceRef:'hold:1:label'},
  {caseId:'hold:2',decisionAt:'2026-10-04T12:00:00Z',
    outcomeAt:'2026-10-04T13:00:00Z',outcomeAvailableAt:'2026-10-04T13:05:00Z',
    realizedReturnBps:-10,oneWayCostBps:3,evidenceRef:'hold:2:label'}
];
const lock=()=>new MoneyInProcessHoldoutLockbox({
  holdoutId:'locked-set-1',sourceSnapshotHash:'source:snapshot',
  embargoMs:3600000,cases:rows
});
function freeze(l:MoneyInProcessHoldoutLockbox,ledger=new MoneyStrategyTrialLedger(candidate)){
  if(!ledger.trialCount)ledger.appendDevelopmentTrial(trial);
  return ledger.freeze({frozenAt:'2026-10-02T10:00:00Z',manifest:l.manifest,
    predictions:[{caseId:'hold:2',signal:1},{caseId:'hold:1',signal:1}]});
}
test('FINISH.11 candidate hash is deterministic, ordered, readonly and cannot grant authority',()=>{
  const reordered=registerMoneyStrategy({...candidateInput,
    sourceEvidenceIds:[...candidateInput.sourceEvidenceIds].reverse(),
    parameters:{shortAllowed:false,lookback:20,spreadLimit:2.5}});
  assert.equal(candidate.candidateHash,reordered.candidateHash);
  assert.doesNotThrow(()=>assertMoneyStrategyCandidate(candidate));
  assert.equal(candidate.canExecute,false);
  assert.throws(()=>assertMoneyStrategyCandidate({...candidate,
    parameters:{...candidate.parameters,lookback:999}}),/CANDIDATE_TAMPERED/);
  assert.throws(()=>registerMoneyStrategy({...candidateInput,
    informationCutoff:'2026-10-04T00:00:00Z'}),/FUTURE_SOURCE/);
  assert.throws(()=>registerMoneyStrategy({...candidateInput,maximumDevelopmentTrials:0}),/TRIAL_BUDGET_INVALID/);
});
test('FINISH.11 trial ledger accounts for attempts, net costs, and never tunes after freeze',()=>{
  const ledger=new MoneyStrategyTrialLedger(candidate);
  ledger.appendDevelopmentTrial(trial);
  assert.throws(()=>ledger.appendDevelopmentTrial(trial),/TRIAL_IDENTITY_INVALID/);
  assert.throws(()=>ledger.appendDevelopmentTrial({...trial,trialId:'dev:bad',
    totalCostBps:3}),/TRIAL_METRICS_INVALID/);
  ledger.appendDevelopmentTrial({...trial,trialId:'dev:2'});
  assert.throws(()=>ledger.appendDevelopmentTrial({...trial,trialId:'dev:3'}),/TRIAL_BUDGET_EXHAUSTED/);
  const locked=freeze(lock(),ledger);
  assert.equal(locked.trialIds.length,2);
  assert.equal(ledger.frozen,true);
  assert.equal(locked.canAuthorizeLive,false);
  assert.throws(()=>ledger.appendDevelopmentTrial({...trial,trialId:'dev:4'}),/ALREADY_FROZEN/);
  assert.throws(()=>freeze(lock(),ledger),/ALREADY_FROZEN/);
});
test('FINISH.11 predictions freeze before first holdout decision and are one-shot after embargo',()=>{
  const lockbox=lock(),frozen=freeze(lockbox);
  assert.equal(lockbox.consumed,false);
  assert.deepEqual(lockbox.manifest.caseIds,['hold:1','hold:2']);
  assert.ok(!('realizedReturnBps' in lockbox.manifest));
  assert.throws(()=>lockbox.evaluateOnce(frozen,'2026-10-04T13:30:00Z'),/EMBARGO_NOT_COMPLETE/);
  assert.equal(lockbox.consumed,false);
  const grade=lockbox.evaluateOnce(frozen,'2026-10-04T14:05:00Z');
  assert.equal(grade.netReturnBps,30-4-10-6);
  assert.equal(grade.sampleCount,2);
  assert.equal(grade.proofStatus,'HISTORICAL_HOLDOUT_RESEARCH_ONLY');
  assert.equal(grade.canExecute,false);
  assert.throws(()=>lockbox.evaluateOnce(frozen,'2026-10-05T00:00:00Z'),/ALREADY_CONSUMED/);
});
test('FINISH.11 holdout enforces forecast coverage and historical boundary',()=>{
  const box=lock(),ledger=new MoneyStrategyTrialLedger(candidate);
  ledger.appendDevelopmentTrial(trial);
  assert.throws(()=>ledger.freeze({frozenAt:'2026-10-02T10:00:00Z',
    manifest:box.manifest,predictions:[{caseId:'hold:1',signal:1}]}),/PREDICTIONS_MISMATCH/);
  assert.throws(()=>ledger.freeze({frozenAt:'2026-10-04T10:00:00Z',
    manifest:box.manifest,predictions:[{caseId:'hold:1',signal:1},{caseId:'hold:2',signal:0}]}),
    /NOT_PROSPECTIVELY_LOCKED/);
  const good=freeze(box,ledger);
  assert.throws(()=>box.evaluateOnce({...good,
    predictions:[{caseId:'hold:1',signal:-1},{caseId:'hold:2',signal:1}]},
    '2026-10-05T12:00:00Z'),/FROZEN_PROOF_INVALID/);
  assert.throws(()=>box.evaluateOnce({...good,holdoutCommitmentHash:'forged'},
    '2026-10-05T12:00:00Z'),/FROZEN_PROOF_INVALID/);
  assert.equal(box.consumed,false);
});
test('FINISH.11 label-maturation and duplicate-case admission fails closed',()=>{
  assert.throws(()=>new MoneyInProcessHoldoutLockbox({
    holdoutId:'x',sourceSnapshotHash:'y',embargoMs:0,cases:[rows[0]!,rows[0]!]}),/HOLDOUT_ROW_INVALID/);
  assert.throws(()=>new MoneyInProcessHoldoutLockbox({
    holdoutId:'x',sourceSnapshotHash:'y',embargoMs:0,
    cases:[{...rows[0]!,outcomeAvailableAt:'2026-10-02T13:00:00Z'}]}),/HOLDOUT_ROW_INVALID/);
  const ledger=new MoneyStrategyTrialLedger(candidate);
  assert.throws(()=>ledger.appendDevelopmentTrial({...trial,lastOutcomeAvailableAt:'2026-10-02T00:00:00Z'}),
    /TRIAL_METRICS_INVALID/);
});
