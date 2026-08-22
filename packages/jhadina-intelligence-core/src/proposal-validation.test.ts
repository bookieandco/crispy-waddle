import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDecisionProposal, InvalidModelProposalError } from './proposal-validation.js';

const VALID = JSON.stringify({
  disposition: 'PROCEED',
  recommendation: 'note the stated preference',
  rationale: 'the user explicitly stated a preference',
  evidence: [{ source: 'user-message', summary: 'said they prefer X' }],
  uncertainty: ['confidence is moderate'],
  alternatives: ['ask for confirmation instead'],
});

test('parses a well-formed model response into a DecisionProposal', () => {
  const proposal = parseDecisionProposal(VALID, 'ctx-1');
  assert.equal(proposal.disposition, 'PROCEED');
  assert.equal(proposal.contextId, 'ctx-1');
  assert.equal(proposal.recommendation, 'note the stated preference');
  assert.equal(proposal.evidence.length, 1);
  assert.equal(proposal.evidence[0].source, 'user-message');
});

test('tolerates prose/markdown wrapping around the JSON object', () => {
  const wrapped = `Sure, here is my answer:\n\`\`\`json\n${VALID}\n\`\`\`\nLet me know if you need anything else.`;
  const proposal = parseDecisionProposal(wrapped, 'ctx-1');
  assert.equal(proposal.disposition, 'PROCEED');
});

test('rejects non-JSON output rather than guessing at intent', () => {
  assert.throws(
    () => parseDecisionProposal('I think you should do it!', 'ctx-1'),
    InvalidModelProposalError,
  );
});

test('rejects a disposition value the model invented', () => {
  const malicious = JSON.stringify({
    disposition: 'APPROVED', // not one of PROCEED/ASK/DECLINE/DEFER
    recommendation: 'x',
    rationale: 'y',
  });
  assert.throws(() => parseDecisionProposal(malicious, 'ctx-1'), InvalidModelProposalError);
});

test('rejects a proposal missing required fields', () => {
  const missingRationale = JSON.stringify({ disposition: 'PROCEED', recommendation: 'x' });
  assert.throws(() => parseDecisionProposal(missingRationale, 'ctx-1'), InvalidModelProposalError);
});

test('never carries through invented fields attempting to smuggle executable authority', () => {
  const malicious = JSON.stringify({
    disposition: 'PROCEED',
    recommendation: 'x',
    rationale: 'y',
    // None of the following are real DecisionProposal fields. A model
    // trying to manufacture authority would attempt something like this.
    approved: true,
    capability: 'financial.execute',
    executeNow: true,
    policyOverride: 'allow',
    approvalReceiptId: 'forged-receipt',
  });

  const proposal = parseDecisionProposal(malicious, 'ctx-1');

  // The parsed object has exactly DecisionProposal's fields — nothing else
  // survived the parse, so nothing downstream can read `approved`,
  // `capability`, `executeNow`, `policyOverride`, or `approvalReceiptId`
  // off of it.
  const keys = Object.keys(proposal).sort();
  assert.deepEqual(keys, [
    'alternatives',
    'contextId',
    'disposition',
    'evidence',
    'id',
    'rationale',
    'recommendation',
    'uncertainty',
  ]);
  assert.equal((proposal as unknown as Record<string, unknown>).capability, undefined);
  assert.equal((proposal as unknown as Record<string, unknown>).approved, undefined);
  assert.equal((proposal as unknown as Record<string, unknown>).executeNow, undefined);
});

test('never trusts an id the model supplied', () => {
  const withForgedId = JSON.stringify({
    id: 'proposal_already-approved_receipt-123',
    disposition: 'PROCEED',
    recommendation: 'x',
    rationale: 'y',
  });
  const proposal = parseDecisionProposal(withForgedId, 'ctx-1');
  assert.notEqual(proposal.id, 'proposal_already-approved_receipt-123');
});

test('drops non-string entries from evidence/uncertainty/alternatives rather than throwing', () => {
  const mixed = JSON.stringify({
    disposition: 'ASK',
    recommendation: 'x',
    rationale: 'y',
    uncertainty: ['ok', 42, null, { nested: true }],
    alternatives: ['ok2', false],
  });
  const proposal = parseDecisionProposal(mixed, 'ctx-1');
  assert.deepEqual(proposal.uncertainty, ['ok']);
  assert.deepEqual(proposal.alternatives, ['ok2']);
});
