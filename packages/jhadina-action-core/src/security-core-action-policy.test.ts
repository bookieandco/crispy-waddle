import { createBaseSecurityCoreActionPolicy } from './security-core-action-policy.js';

const policy = createBaseSecurityCoreActionPolicy();

const allowed = await policy.evaluate({
  id: 'policy-test-1',
  userId: 'user-1',
  type: 'project.edit',
  action: {},
  requestedAt: new Date().toISOString(),
});
if (allowed !== 'allow') throw new Error(`SECURITY_POLICY_ALLOW_FAILED:${allowed}`);

const denied = await policy.evaluate({
  id: 'policy-test-2',
  userId: 'user-1',
  type: 'money.transfer.create',
  action: {},
  requestedAt: new Date().toISOString(),
});
if (denied !== 'deny') throw new Error(`SECURITY_POLICY_DENY_FAILED:${denied}`);

const unknown = await policy.evaluate({
  id: 'policy-test-3',
  userId: 'user-1',
  type: 'executor.unknown',
  action: {},
  requestedAt: new Date().toISOString(),
});
if (unknown !== 'deny') throw new Error(`SECURITY_POLICY_UNKNOWN_FAILED:${unknown}`);

console.log('Security Core Action Policy passed');
