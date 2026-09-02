/**
 * Contract tests for the Core Spine → Action Core translation boundary.
 * Issue #140: One explicit translation/composition boundary.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  translateToActionCoreRequest,
  translateFromActionCoreResult,
  translateFromActionCoreError,
  ActionCorePortAdapter,
  type ActionCoreExecutor,
} from './action-core-adapter.js';
import type { ActionRequest as SpineActionRequest } from './types.js';

const makeSpineRequest = (overrides: Partial<SpineActionRequest> = {}): SpineActionRequest => ({
  id: 'req-1',
  proposalId: 'prop-1',
  capability: 'memory',
  operation: 'propose',
  input: { content: 'test' },
  reversible: false,
  consequenceLevel: 'low',
  ...overrides,
});

describe('CoreSpine → ActionCore translation boundary', () => {

  it('capability + operation become the Action Core type', () => {
    const coreReq = translateToActionCoreRequest(makeSpineRequest(), 'user-a');
    assert.equal(coreReq.type, 'memory.propose');
  });

  it('id is preserved across the boundary', () => {
    const spineReq = makeSpineRequest({ id: 'spine-uuid-42' });
    const coreReq = translateToActionCoreRequest(spineReq, 'user-a');
    assert.equal(coreReq.id, 'spine-uuid-42');
  });

  it('input becomes the action payload', () => {
    const input = { content: 'prefer dark mode', confidence: 0.9 };
    const coreReq = translateToActionCoreRequest(makeSpineRequest({ input }), 'user-a');
    assert.deepEqual(coreReq.action, input);
  });

  it('userId is injected by the caller (not present in Spine ActionRequest)', () => {
    const coreReq = translateToActionCoreRequest(makeSpineRequest(), 'injected-user-id');
    assert.equal(coreReq.userId, 'injected-user-id');
  });

  it('approvalReceiptId is optional and only set when provided', () => {
    const withoutReceipt = translateToActionCoreRequest(makeSpineRequest(), 'user-a');
    assert.equal(withoutReceipt.approvalReceiptId, undefined);

    const withReceipt = translateToActionCoreRequest(makeSpineRequest(), 'user-a', 'receipt-xyz');
    assert.equal(withReceipt.approvalReceiptId, 'receipt-xyz');
  });

  it('translateFromActionCoreResult produces a successful Spine ActionResult', () => {
    const result = translateFromActionCoreResult('req-id', { candidateId: 'cand-1' });
    assert.equal(result.requestId, 'req-id');
    assert.equal(result.success, true);
    assert.deepEqual(result.output, { candidateId: 'cand-1' });
    assert.ok(result.completedAt);
  });

  it('translateFromActionCoreError produces a failed Spine ActionResult', () => {
    const result = translateFromActionCoreError('req-id', new Error('Action denied: memory.propose'));
    assert.equal(result.requestId, 'req-id');
    assert.equal(result.success, false);
    assert.match(result.error ?? '', /Action denied/);
  });

  it('ActionCorePortAdapter.execute delegates to the concrete executor', async () => {
    let capturedRequest: unknown;
    const executor: ActionCoreExecutor = {
      async execute(req) {
        capturedRequest = req;
        return { ok: true };
      },
    };
    const adapter = new ActionCorePortAdapter(
      executor,
      'user-a',
      { capability: 'memory', operation: 'propose', input: { content: 'test' } },
    );
    const spineReq = makeSpineRequest();
    const result = await adapter.execute(spineReq);

    assert.equal(result.success, true);
    assert.deepEqual(result.output, { ok: true });
    assert.deepEqual((capturedRequest as { type: string }).type, 'memory.propose');
  });

  it('ActionCorePortAdapter propagates Action Core errors as failed Spine results', async () => {
    const executor: ActionCoreExecutor = {
      async execute() {
        throw new Error('denied by policy');
      },
    };
    const adapter = new ActionCorePortAdapter(
      executor,
      'user-a',
      { capability: 'memory', operation: 'propose' },
    );
    const result = await adapter.execute(makeSpineRequest());
    assert.equal(result.success, false);
    assert.match(result.error ?? '', /denied by policy/);
  });

  it('ActionCorePortAdapter.prepare returns undefined when policy denies (allowed=false, requiredApproval=false)', async () => {
    const executor: ActionCoreExecutor = { async execute() { return null; } };
    const adapter = new ActionCorePortAdapter(
      executor,
      'user-a',
      { capability: 'memory', operation: 'propose' },
    );
    const result = await adapter.prepare(
      { id: 'prop-1', contextId: 'ctx-1', disposition: 'DECLINE', recommendation: 'skip', rationale: 'policy', evidence: [], uncertainty: [], alternatives: [] },
      { id: 'pol-1', proposalId: 'prop-1', allowed: false, reason: 'denied', requiredApproval: false, evaluatedAt: new Date().toISOString() },
    );
    assert.equal(result, undefined);
  });

  it('ActionCorePortAdapter.prepare returns undefined when allowed=false even if requiredApproval=true (hard deny wins)', async () => {
    // Regression: a receipt being present must not unlock an explicitly-denied action.
    const executor: ActionCoreExecutor = { async execute() { return null; } };
    const adapter = new ActionCorePortAdapter(
      executor,
      'user-a',
      { capability: 'memory', operation: 'propose' },
      'receipt-xyz', // receipt present — must NOT unlock a hard deny
    );
    const result = await adapter.prepare(
      { id: 'prop-hd', contextId: 'ctx-hd', disposition: 'DECLINE', recommendation: 'skip', rationale: 'hard-deny', evidence: [], uncertainty: [], alternatives: [] },
      { id: 'pol-hd', proposalId: 'prop-hd', allowed: false, reason: 'hard deny', requiredApproval: true, evaluatedAt: new Date().toISOString() },
    );
    assert.equal(result, undefined, 'allowed=false must always return undefined regardless of requiredApproval or receipt');
  });

  it('ActionCorePortAdapter.prepare returns undefined when approval required but no receipt', async () => {
    const executor: ActionCoreExecutor = { async execute() { return null; } };
    const adapter = new ActionCorePortAdapter(
      executor,
      'user-a',
      { capability: 'memory', operation: 'propose' },
      // no approvalReceiptId
    );
    const result = await adapter.prepare(
      { id: 'prop-2', contextId: 'ctx-2', disposition: 'PROCEED', recommendation: 'do it', rationale: 'values', evidence: [], uncertainty: [], alternatives: [] },
      { id: 'pol-2', proposalId: 'prop-2', allowed: true, reason: 'ok', requiredApproval: true, evaluatedAt: new Date().toISOString() },
    );
    assert.equal(result, undefined);
  });

  it('ActionCorePortAdapter.prepare materialises a SpineActionRequest when policy allows', async () => {
    const executor: ActionCoreExecutor = { async execute() { return null; } };
    const adapter = new ActionCorePortAdapter(
      executor,
      'user-a',
      { capability: 'memory', operation: 'propose', input: { content: 'test' }, reversible: false, consequenceLevel: 'low' },
    );
    const proposal = {
      id: 'prop-3', contextId: 'ctx-3', disposition: 'PROCEED' as const,
      recommendation: 'proceed', rationale: 'allowed', evidence: [], uncertainty: [], alternatives: [],
    };
    const policy = {
      id: 'pol-3', proposalId: 'prop-3', allowed: true, reason: 'ok',
      requiredApproval: false, evaluatedAt: new Date().toISOString(),
    };
    const request = await adapter.prepare(proposal, policy);
    assert.ok(request, 'prepare() must return a concrete ActionRequest when policy allows');
    assert.equal(request?.proposalId, 'prop-3');
    assert.equal(request?.capability, 'memory');
    assert.equal(request?.operation, 'propose');
    assert.deepEqual(request?.input, { content: 'test' });
  });
});
