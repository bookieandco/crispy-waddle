/**
 * BIZ-PURSE.13: passive GitHub CI evidence inventory, not a deployment permit.
 * The supplied run records are UNTRUSTED until independently checked against
 * GitHub for the exact PR head. No secrets, network or business APIs are used.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_CI_CHECKS = Object.freeze([
  'Opportunity Core CI',
  'Money R13B Certification',
  'MONEY-FINISH P0 Contracts',
  'Jhadina Launch Gate',
]);
const SHA = /^[a-f0-9]{40}$/;

export function assessBizPurse13Release(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !SHA.test(input.expectedHeadSha ?? '') ||
      typeof input.observedAt !== 'string' || !Number.isFinite(Date.parse(input.observedAt)) ||
      !Array.isArray(input.workflowRuns)) {
    throw new Error('BIZ_PURSE_13_REPORT_INVALID');
  }
  const ids = new Set();
  const runs = [];
  for (const run of input.workflowRuns) {
    if (!run || typeof run !== 'object' || !Number.isSafeInteger(run.id) || run.id <= 0 ||
        ids.has(run.id) || typeof run.name !== 'string' ||
        !SHA.test(run.headSha ?? '') ||
        !['queued', 'pending', 'in_progress', 'completed'].includes(run.status) ||
        !['success', 'failure', 'cancelled', 'timed_out', 'skipped', 'neutral', null].includes(run.conclusion)) {
      throw new Error('BIZ_PURSE_13_CI_RUN_INVALID_OR_DUPLICATE');
    }
    ids.add(run.id);
    runs.push(run);
  }
  const requiredChecks = REQUIRED_CI_CHECKS.map(name => {
    const candidates = runs.filter(r => r.name === name && r.headSha === input.expectedHeadSha)
      .sort((a, b) => b.id - a.id);
    const chosen = candidates[0];
    const passed = chosen?.status === 'completed' && chosen.conclusion === 'success';
    return Object.freeze({
      name, runId: chosen?.id ?? null,
      result: !chosen ? 'MISSING_EXACT_HEAD' : passed ? 'REPORTED_PASS' :
        chosen.status === 'completed' ? 'FAILED_OR_INCONCLUSIVE' : 'NOT_COMPLETED',
    });
  });
  const ciReportedPassing = requiredChecks.every(x => x.result === 'REPORTED_PASS');
  const blockers = requiredChecks.filter(x => x.result !== 'REPORTED_PASS')
    .map(x => `CI_${x.result}:${x.name}`);
  // Even if callers fabricate four passing run records, this report has no
  // independent source attestation. It is NOT a permission or certification.
  return Object.freeze({
    headSha: input.expectedHeadSha,
    observedAt: input.observedAt,
    requiredChecks: Object.freeze(requiredChecks),
    softwareCiReportedState: ciReportedPassing ? 'ALL_REQUIRED_CHECKS_REPORTED_PASS' : 'INCOMPLETE',
    blockers: Object.freeze([...blockers, 'INDEPENDENT_GITHUB_VERIFICATION_REQUIRED',
      'SUPABASE_BACKUP_AND_MIGRATION_RECOVERY_NOT_CERTIFIED',
      'PROVIDER_PAYMENTS_AND_FUNDING_NOT_COMMISSIONED',
      'UNATTENDED_HOST_AND_SETTLEMENT_NOT_CERTIFIED']),
    authority: 'UNTRUSTED_CI_INVENTORY_ONLY',
    prMergeApproved: false,
    productionCertified: false,
    externalActionsAuthorized: false,
    moneyMovementAuthorized: false,
    tradingAuthorized: false,
    unattendedHostAuthorized: false,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/biz-purse-13-release-audit.mjs <ci-run-inventory.json>');
    process.exitCode = 2;
  } else {
    try {
      const output = assessBizPurse13Release(JSON.parse(readFileSync(file, 'utf8')));
      console.log(JSON.stringify(output, null, 2));
      if (output.softwareCiReportedState !== 'ALL_REQUIRED_CHECKS_REPORTED_PASS') process.exitCode = 1;
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = 2;
    }
  }
}
