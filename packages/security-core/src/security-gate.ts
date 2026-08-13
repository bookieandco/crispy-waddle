import { JhadinaSecurityCore, createSecurityRequest, type SecurityDecision } from './index.js';

export type SecurityGateCase = {
  id: string;
  capability: string;
  expected: SecurityDecision;
  requiresApproval?: boolean;
  mutate?: (request: ReturnType<typeof createSecurityRequest>) => ReturnType<typeof createSecurityRequest>;
};

export type SecurityGateResult = SecurityGateCase & {
  actual: SecurityDecision;
  passed: boolean;
};

export const SECURITY_GATE_CASES: readonly SecurityGateCase[] = [
  { id: 'allow-project-edit', capability: 'project.edit', expected: 'allow' },
  { id: 'deny-unknown-capability', capability: 'security.unknown', expected: 'deny' },
  { id: 'require-publish-approval', capability: 'public.publish', expected: 'approval_required' },
  { id: 'deny-expired-request', capability: 'project.edit', expected: 'deny', mutate: (request) => ({ ...request, expiresAt: Date.now() - 1 }) },
];

export function runSecurityGate(): SecurityGateResult[] {
  const core = new JhadinaSecurityCore(JHADINA_GATE_POLICY);
  const results = SECURITY_GATE_CASES.map((test) => {
    const request = createSecurityRequest({
      requestId: `security-gate:${test.id}`,
      actorId: 'security-gate-test-user',
      domain: 'security-gate',
      capability: test.capability,
      requiresApproval: test.requiresApproval,
    });
    const mutated = test.mutate ? test.mutate(request) : request;
    const actual = core.authorize(mutated);
    return { ...test, actual, passed: actual === test.expected };
  });

  const replay = createSecurityRequest({
    requestId: 'security-gate:replay-first',
    actorId: 'security-gate-test-user',
    domain: 'security-gate',
    capability: 'project.edit',
  });
  const first = core.authorize(replay);
  const second = core.authorize({ ...replay, requestId: 'security-gate:replay-second' });
  results.push({
    id: 'deny-replayed-nonce',
    capability: 'project.edit',
    expected: 'deny',
    actual: second,
    passed: first === 'allow' && second === 'deny',
  });

  return results;
}

const JHADINA_GATE_POLICY = {
  allowedCapabilities: ['project.edit', 'public.publish'],
  approvalCapabilities: ['public.publish'],
} as const;
