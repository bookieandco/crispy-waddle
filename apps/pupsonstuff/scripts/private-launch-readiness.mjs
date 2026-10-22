#!/usr/bin/env node
/**
 * Read-only, human/auditor-supplied evidence ledger for a private PupsonStuff
 * acceptance URL. This script DOES NOT create, alter, publish, deploy or buy.
 * A passing source build cannot substitute for provider-side private access
 * and real physical iPhone evidence.
 */
import {fileURLToPath} from 'node:url';

const SHA=/^[a-f0-9]{40}$/;
export function evaluatePrivateLaunchReadiness(e={}) {
  const blockers=[];
  const sha=String(e.sourceSha || '');
  if (!SHA.test(sha)) blockers.push('Exact 40-character Git commit not pinned.');
  if (!e.separatePupsonProject || !e.pupsonProjectId ||
      e.pupsonProjectId === e.jhadinaProjectId) {
    blockers.push('Separate PupsonStuff project must be verified, never reuse Jhadina.');
  }
  if (e.ownerProtectionVerified !== true ||
      e.anonymousAccessDenied !== true) {
    blockers.push('Real hosted URL must reject unauthenticated people and confirm owner access.');
  }
  if (e.deployedSourceSha !== sha) blockers.push('Protected deployment does not match the audited Git SHA.');
  if (e.runtimeHealthChecked !== true ||
      e.originalModelAssetsChecked !== true) {
    blockers.push('Protected host and six immutable original GLBs lack runtime canary proof.');
  }
  if (e.checkoutBlocked !== true ||
      e.printifyBlocked !== true ||
      e.creativeSpendingBlocked !== true) {
    blockers.push('Private prototype must prove zero payment, Printify and paid AI side effects.');
  }
  if (e.physicalIphoneSafariApproved !== true) {
    blockers.push('Actual owner iPhone Safari upload/portrait/studio/cart acceptance is not signed off.');
  }
  if (e.ownerDeploymentApproval !== true) {
    blockers.push('Owner has not approved deploying a dedicated private PupsonStuff site.');
  }
  return {
    schema:'pupson.private-launch-readiness.v1',
    ready:blockers.length===0,
    blocked:blockers,
    testedSourceSha:SHA.test(sha)?sha:null,
    note:'Evidence checklist only: green status requires operator-verifiable receipts, not flags alone.',
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report=evaluatePrivateLaunchReadiness({sourceSha:process.env.GITHUB_SHA});
  console.log(JSON.stringify(report,null,2));
  if(!process.argv.includes('--report-only') && !report.ready) process.exitCode=1;
}
