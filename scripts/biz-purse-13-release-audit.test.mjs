import assert from 'node:assert/strict';
import test from 'node:test';
import { assessBizPurse13Release, REQUIRED_CI_CHECKS } from './biz-purse-13-release-audit.mjs';
const sha = 'a'.repeat(40), other = 'b'.repeat(40);
const inventory = () => ({ expectedHeadSha: sha, observedAt: '2026-10-14T23:00:00Z',
  workflowRuns: REQUIRED_CI_CHECKS.map((name,i) => ({
    id: i+1, name, headSha:sha, status:'completed', conclusion:'success',
  })) });

test('all reported passing checks only permit nonauthoritative code review', () => {
  const r=assessBizPurse13Release(inventory());
  assert.equal(r.softwareCiReportedState,'ALL_REQUIRED_CHECKS_REPORTED_PASS');
  assert.equal(r.productionCertified,false);
  assert.equal(r.prMergeApproved,false);
  assert.equal(r.moneyMovementAuthorized,false);
  assert(r.blockers.includes('INDEPENDENT_GITHUB_VERIFICATION_REQUIRED'));
});
test('a missing exact-head run always blocks reported readiness', () => {
  const data=inventory(); data.workflowRuns[0].headSha=other;
  const r=assessBizPurse13Release(data);
  assert.equal(r.softwareCiReportedState,'INCOMPLETE');
  assert.equal(r.requiredChecks[0].result,'MISSING_EXACT_HEAD');
});
test('a running launch gate is not reported as passed', () => {
  const data=inventory(); const latest=data.workflowRuns.at(-1);
  latest.status='in_progress'; latest.conclusion=null;
  const r=assessBizPurse13Release(data);
  assert.equal(r.softwareCiReportedState,'INCOMPLETE');
  assert.equal(r.requiredChecks.at(-1).result,'NOT_COMPLETED');
});
test('latest retry takes precedence over older passing attempts', () => {
  const data=inventory();data.workflowRuns.push({id:50,name:'Opportunity Core CI',headSha:sha,status:'completed',conclusion:'failure'});
  const r=assessBizPurse13Release(data);
  assert.equal(r.requiredChecks[0].runId,50);
  assert.equal(r.requiredChecks[0].result,'FAILED_OR_INCONCLUSIVE');
});
test('recovered latest retry can replace earlier failure', () => {
  const data=inventory();data.workflowRuns.push({id:50,name:'Opportunity Core CI',headSha:sha,status:'completed',conclusion:'success'});
  const r=assessBizPurse13Release(data);
  assert.equal(r.requiredChecks[0].runId,50);
  assert.equal(r.softwareCiReportedState,'ALL_REQUIRED_CHECKS_REPORTED_PASS');
});
test('duplicate IDs and malformed statuses are rejected', () => {
  const data=inventory();data.workflowRuns[1].id=data.workflowRuns[0].id;
  assert.throws(()=>assessBizPurse13Release(data),/RUN_INVALID_OR_DUPLICATE/);
  const data2=inventory();data2.workflowRuns[2].conclusion='unknown';
  assert.throws(()=>assessBizPurse13Release(data2),/RUN_INVALID_OR_DUPLICATE/);
});
test('an unpinned or malformed head is rejected', () => {
  assert.throws(()=>assessBizPurse13Release({...inventory(),expectedHeadSha:'main'}),/REPORT_INVALID/);
  assert.throws(()=>assessBizPurse13Release({...inventory(),observedAt:'unknown'}),/REPORT_INVALID/);
});
