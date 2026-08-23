import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createSecurityRequest,
  JHADINA_BASE_SECURITY_POLICY,
  JhadinaSecurityCore,
} from './index.js'

test('overage.review is explicitly allowed without approval', () => {
  const security = new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY)
  const request = createSecurityRequest({
    requestId: 'review-1',
    actorId: 'user-1',
    domain: 'jhadina-action',
    capability: 'overage.review',
  })

  assert.equal(security.authorize(request), 'allow')
})

test('consequential overage capabilities remain denied', () => {
  const security = new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY)

  for (const capability of [
    'overage.prepare_contact',
    'overage.prepare_claim',
    'overage.submit_claim',
  ]) {
    const request = createSecurityRequest({
      requestId: `request-${capability}`,
      actorId: 'user-1',
      domain: 'jhadina-action',
      capability,
    })

    assert.equal(security.authorize(request), 'deny', capability)
  }
})
