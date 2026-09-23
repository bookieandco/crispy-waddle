import assert from 'node:assert/strict';
import test from 'node:test';
import type { DecisionProposal, ExpressionDirective } from '@jhadina/core-spine';
import { realizeGovernedExpression } from './expression-realization.js';

test('JHADINA-EXPRESSION.FINAL keeps semantics immutable while carrying rich presentation', () => {
  const proposal: DecisionProposal = {
    id: 'proposal-1',
    contextId: 'context-1',
    disposition: 'PROCEED',
    recommendation: 'Run the pre-launch checks in order.',
    rationale: 'The sequence is ready for deterministic verification.',
    evidence: [],
    uncertainty: [],
    alternatives: [],
  };
  const directive: ExpressionDirective = {
    mode: 'direct',
    allowProfanity: true,
    allowQuip: true,
    register: 'household-ops',
    cadenceStyle: 'conversational',
    pauseDensity: 'moderate',
    metaphorDensity: 'light',
    bitDepth: 1,
    allowPlayfulDisagreement: true,
    symbolicFraming: 'off',
    storytellingDepth: 'brief',
    edginess: 'light',
    reentryToPlayfulness: 'allowed',
    operationalSass: 'light',
    affectionateTeasing: true,
    workloadBoundary: 'explicit',
    evidenceDiscipline: 'standard',
    speakingRate: 'normal',
    deliberatePauses: true,
  };

  const result = realizeGovernedExpression(proposal, directive);

  assert.equal(result.proposal, proposal);
  assert.equal(result.proposal.recommendation, 'Run the pre-launch checks in order.');
  assert.equal(result.presentation.register, 'household-ops');
  assert.equal(result.presentation.operationalSass, 'light');
  assert.equal(result.presentation.affectionateTeasing, true);
  assert.equal(result.presentation.workloadBoundary, 'explicit');
  assert.equal(result.presentation.bitDepth, 1);
  assert.deepEqual(result.segments, [
    { kind: 'semantic', text: 'Run the pre-launch checks in order.' },
  ]);
});

test('presentation cannot manufacture callbacks or cultural references', () => {
  const proposal: DecisionProposal = {
    id: 'proposal-2',
    contextId: 'context-2',
    disposition: 'PROCEED',
    recommendation: 'Proceed.',
    rationale: 'No extra assets were governed into the directive.',
    evidence: [],
    uncertainty: [],
    alternatives: [],
  };
  const result = realizeGovernedExpression(proposal, {
    mode: 'serious',
    allowProfanity: false,
    allowQuip: false,
    register: 'serious',
    operationalSass: 'off',
    affectionateTeasing: false,
    bitDepth: 0,
    symbolicFraming: 'off',
    evidenceDiscipline: 'strict',
  });

  assert.equal(result.presentation.callback, undefined);
  assert.equal(result.presentation.culturalReference, undefined);
  assert.equal(result.segments.length, 1);
});
