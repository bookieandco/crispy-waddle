import { JhadinaSecurityCore, createSecurityRequest, type SecurityDecision } from './index.js';

export type ExtendedSecurityGateResult = {
  id: string;
  capability: string;
  expected: SecurityDecision;
  actual: SecurityDecision;
  passed: boolean;
};

const cases = [
  ['identity-forged-user', 'identity.read', 'deny'],
  ['money-read-only', 'money.account.read', 'deny'],
  ['money-transfer-needs-approval', 'money.transfer.create', 'deny'],
  ['privacy-submit-needs-approval', 'money.privacy.submit-request', 'deny'],
  ['vault-decrypt-needs-capability', 'vault.decrypt', 'deny'],
  ['secrets-export-denied', 'secrets.export', 'deny'],
  ['executor-unknown-capability', 'executor.unknown', 'deny'],
  ['audit-export-denied', 'audit.export', 'deny'],
  ['upload-quarantine', 'upload.execute', 'deny'],
] as const;

export function runExtendedSecurityGate(): ExtendedSecurityGateResult[] {
  const core = new JhadinaSecurityCore({
    allowedCapabilities: ['project.edit', 'public.publish'],
    approvalCapabilities: ['public.publish'],
  });

  return cases.map(([id, capability, expected]) => {
    const request = createSecurityRequest({
      requestId: `security-extended:${id}`,
      actorId: 'security-gate-test-user',
      domain: 'security-gate',
      capability,
    });
    const actual = core.authorize(request);
    return { id, capability, expected, actual, passed: actual === expected };
  });
}

export function assertExtendedSecurityGatePasses(): void {
  const results = runExtendedSecurityGate();
  const failures = results.filter((result) => !result.passed);
  if (failures.length) {
    throw new Error(`SECURITY_EXTENDED_GATE_FAILED:${failures.map((f) => f.id).join(',')}`);
  }
}
