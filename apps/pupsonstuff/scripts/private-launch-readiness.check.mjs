import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePrivateLaunchReadiness} from './private-launch-readiness.mjs';

const sha='a'.repeat(40);
const evidence={
  sourceSha:sha,deployedSourceSha:sha,
  pupsonProjectId:'prj_pupson_separate',jhadinaProjectId:'prj_jhadina',
  separatePupsonProject:true,ownerProtectionVerified:true,
  anonymousAccessDenied:true,runtimeHealthChecked:true,
  originalModelAssetsChecked:true,checkoutBlocked:true,
  printifyBlocked:true,creativeSpendingBlocked:true,
  physicalIphoneSafariApproved:true,ownerDeploymentApproval:true,
};

test('a staged complete proof contract can become ready',()=>{
  const p=evaluatePrivateLaunchReadiness(evidence);
  assert.equal(p.ready,true);
  assert.deepEqual(p.blocked,[]);
});

test('default fail closed and missing physical-device signoff cannot pass',()=>{
  const empty=evaluatePrivateLaunchReadiness({});
  assert.equal(empty.ready,false);
  assert.ok(empty.blocked.length>=6);
  const noPhone=evaluatePrivateLaunchReadiness({...evidence,physicalIphoneSafariApproved:false});
  assert.equal(noPhone.ready,false);
  assert.ok(noPhone.blocked.some(x=>x.includes('iPhone')));
});

test('Jhadina project reuse or unauthenticated access fails even with all other evidence',()=>{
  assert.equal(evaluatePrivateLaunchReadiness({
    ...evidence,pupsonProjectId:'prj_jhadina',
  }).ready,false);
  assert.equal(evaluatePrivateLaunchReadiness({
    ...evidence,anonymousAccessDenied:false,
  }).ready,false);
});

test('no exact commit, payment blocker, or owner deployment approval means no release',()=>{
  for (const override of [
    {deployedSourceSha:'b'.repeat(40)},
    {checkoutBlocked:false},
    {ownerDeploymentApproval:false},
    {creativeSpendingBlocked:false},
  ]) {
    assert.equal(evaluatePrivateLaunchReadiness({...evidence,...override}).ready,false);
  }
});
