import assert from 'node:assert/strict';
import test from 'node:test';
import type { DecisionProposal, ExpressionDirective, ExpressionRegister } from '@jhadina/core-spine';
import { realizeGovernedExpression } from './expression-realization.js';

const proposal: DecisionProposal = {
  id: 'quality-proposal',
  contextId: 'quality-context',
  disposition: 'PROCEED',
  recommendation: 'Keep the subsystem result exactly as produced.',
  rationale: 'Expression is presentation-only.',
  evidence: [{ id: 'e1', source: 'test', summary: 'governed subsystem result', observedAt: '2026-09-23T00:00:00.000Z' }],
  uncertainty: [],
  alternatives: [],
};

test('JHADINA-INTERACTION-QUALITY preserves subsystem semantics across presentation registers', () => {
  const registers: ExpressionRegister[] = ['creative', 'social-reaction', 'community-room', 'household-ops', 'serious'];

  for (const register of registers) {
    const directive: ExpressionDirective = {
      mode: register === 'serious' ? 'serious' : 'direct',
      allowProfanity: register !== 'serious',
      allowQuip: register !== 'serious',
      register,
      symbolicFraming: 'off',
      evidenceDiscipline: register === 'serious' ? 'strict' : 'standard',
    };
    const realized = realizeGovernedExpression(proposal, directive);

    assert.equal(realized.proposal, proposal);
    assert.equal(realized.proposal.recommendation, 'Keep the subsystem result exactly as produced.');
    assert.deepEqual(realized.proposal.evidence, proposal.evidence);
    assert.deepEqual(realized.segments[0], {
      kind: 'semantic',
      text: 'Keep the subsystem result exactly as produced.',
    });
  }
});
