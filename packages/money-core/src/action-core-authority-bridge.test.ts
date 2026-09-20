import assert from 'node:assert/strict';
import test from 'node:test';
import type { ActionRequest } from '@jhadina/action-core';
import {
  assertActionCoreAuthorityMatches,
  bindActionCoreAuthority,
  createMoneyActionCoreAuthority,
  fingerprintActionRequest,
  issueActionCoreBoundExecutionPermit,
} from './action-core-authority-bridge.js';
import type { ExecutionAction } from './execution-permit.js';

const request: ActionRequest<unknown> = {
  id: 'a1',
  userId: 'u1',
  type: 'money.payment.create',
  action: {
    capability: 'money.payment.create',
    provider: 'p',
    accountId: 'acct',
    amount: 10,
    currency: 'USD',
  },
  requestedAt: '2026-01-01T00:00:00Z',
  approvalReceiptId: 'approval-1',
};

const action: ExecutionAction = {
  actionId: 'a1',
  userId: 'u1',
  capability: 'money.payment.create',
  provider: 'p',
  accountId: 'acct',
  amount: '10',
  currency: 'USD',
};

function authority() {
  return createMoneyActionCoreAuthority(request, {
    authorityId: 'authority-1',
    decision: 'approval_required',
    policyVersion: 'v1',
    policyHash: 'h1',
    authorizedAt: '2026-01-01T00:00:01Z',
    expiresAt: '2026-01-01T00:10:00Z',
  });
}

function permit() {
  return issueActionCoreBoundExecutionPermit(
    request,
    action,
    authority(),
    {
      expiresAt: '2026-01-01T00:05:00Z',
      now: '2026-01-01T00:00:02Z',
      permitId: 'permit-1',
      nonce: 'n1',
    },
  );
}

test('fingerprint is stable across action object key order', () => {
  const reordered: ActionRequest<unknown> = {
    ...request,
    action: {
      currency: 'USD',
      amount: 10,
      accountId: 'acct',
      provider: 'p',
      capability: 'money.payment.create',
    },
  };
  assert.equal(
    fingerprintActionRequest(request),
    fingerprintActionRequest(reordered),
  );
});

test('creates downstream Action Core authority proof and binds permit', () => {
  const auth = authority();
  assert.equal(auth.actionRequestId, request.id);
  assert.equal(
    auth.actionRequestFingerprint,
    fingerprintActionRequest(request),
  );

  const boundPermit = permit();
  const binding = bindActionCoreAuthority(
    request,
    action,
    boundPermit,
  );
  assert.equal(binding.authorityId, 'authority-1');
  assert.equal(binding.executionPermitId, 'permit-1');
  assert.equal(binding.approvalReceiptId, 'approval-1');
});

test('approval-required authority cannot exist without Action Core receipt', () => {
  assert.throws(
    () =>
      createMoneyActionCoreAuthority(
        { ...request, approvalReceiptId: undefined },
        {
          authorityId: 'authority-no-receipt',
          decision: 'approval_required',
          policyVersion: 'v1',
          policyHash: 'h1',
          authorizedAt: '2026-01-01T00:00:01Z',
          expiresAt: '2026-01-01T00:10:00Z',
        },
      ),
    /APPROVAL_REQUIRED/,
  );
});

test('mutating the request after authority creation fails closed', () => {
  const auth = authority();
  assert.throws(
    () =>
      assertActionCoreAuthorityMatches(
        {
          ...request,
          action: {
            ...(request.action as Record<string, unknown>),
            amount: 11,
          },
        },
        auth,
      ),
    /REQUEST_FINGERPRINT_MISMATCH/,
  );
});

test('permit cannot outlive Action Core authority', () => {
  assert.throws(
    () =>
      issueActionCoreBoundExecutionPermit(
        request,
        action,
        authority(),
        {
          expiresAt: '2026-01-01T00:11:00Z',
          now: '2026-01-01T00:00:02Z',
        },
      ),
    /PERMIT_OUTLIVES_AUTHORITY/,
  );
});

test('binding rejects capability and approval mismatch', () => {
  const boundPermit = permit();
  assert.throws(
    () =>
      bindActionCoreAuthority(
        { ...request, type: 'money.transfer.create' },
        action,
        boundPermit,
      ),
    /CAPABILITY_MISMATCH/,
  );
  assert.throws(
    () =>
      bindActionCoreAuthority(
        { ...request, approvalReceiptId: 'other' },
        action,
        boundPermit,
      ),
    /APPROVAL_MISMATCH/,
  );
});
