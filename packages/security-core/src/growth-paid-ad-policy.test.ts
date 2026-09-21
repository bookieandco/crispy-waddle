import test from 'node:test';
import assert from 'node:assert/strict';
import { JhadinaSecurityCore, JHADINA_BASE_SECURITY_POLICY, createSecurityRequest } from './index.js';

for (const capability of ['paid-ad.publish', 'consequential.outreach'] as const) {
  test(`${capability} is admitted only as approval_required`, () => {
    const decision = new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY).authorize(
      createSecurityRequest({
        requestId: `growth:${capability}`,
        actorId: 'human-user',
        domain: 'growth',
        capability,
      }),
    );
    assert.equal(decision, 'approval_required');
  });
}
