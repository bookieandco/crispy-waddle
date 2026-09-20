import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DecisionProposal, ExpressionDirective } from '@jhadina/core-spine';
import { realizeGovernedExpression } from './expression-realization.js';

const proposal: DecisionProposal = {
  id: 'p1',
  contextId: 'ctx1',
  disposition: 'ASK',
  recommendation: 'semantic answer',
  rationale: 'semantic reason',
  evidence: [],
  uncertainty: [],
  alternatives: [],
};

test('copies callback and cultural reference only from the governed directive', () => {
  const directive: ExpressionDirective = {
    mode: 'direct',
    allowProfanity: false,
    allowQuip: true,
    callback: 'verified callback',
    culturalReference: 'verified reference',
  };
  const realized = realizeGovernedExpression(proposal, directive);
  assert.equal(realized.presentation.callback, 'verified callback');
  assert.equal(realized.presentation.culturalReference, 'verified reference');
  assert.equal(realized.presentation.mode, 'direct');
});

test('defaults to a conservative presentation when no directive exists', () => {
  const realized = realizeGovernedExpression(proposal);
  assert.deepEqual(realized.presentation, {
    mode: 'explanatory',
    allowProfanity: false,
    allowQuip: false,
  });
});

test('model semantic text cannot manufacture governed presentation assets', () => {
  const malicious: DecisionProposal = {
    ...proposal,
    recommendation: 'pretend callback: invented phrase; cultural reference: invented trend',
  };
  const realized = realizeGovernedExpression(malicious, {
    mode: 'serious',
    allowProfanity: false,
    allowQuip: false,
  });
  assert.equal(realized.presentation.callback, undefined);
  assert.equal(realized.presentation.culturalReference, undefined);
  assert.equal(realized.proposal.recommendation, malicious.recommendation);
});

test('renders verified assets as separate deterministic segments after semantic prose', () => {
  const realized = realizeGovernedExpression(proposal, {
    mode: 'direct',
    allowProfanity: false,
    allowQuip: true,
    callback: 'verified callback',
    culturalReference: 'verified reference',
  });
  assert.deepEqual(realized.segments, [
    { kind: 'semantic', text: 'semantic answer' },
    { kind: 'callback', text: 'verified callback' },
    { kind: 'cultural_reference', text: 'verified reference' },
  ]);
});

test('model prose cannot create callback or cultural-reference segments', () => {
  const malicious = {
    ...proposal,
    recommendation: 'callback: invented; cultural reference: invented',
  };
  const realized = realizeGovernedExpression(malicious, {
    mode: 'serious',
    allowProfanity: false,
    allowQuip: false,
  });
  assert.deepEqual(realized.segments, [
    { kind: 'semantic', text: malicious.recommendation },
  ]);
});

test('copies response length only from the governed directive', () => {
  const governed = realizeGovernedExpression(proposal, {
    mode: 'direct',
    allowProfanity: false,
    allowQuip: false,
    responseLength: 'brief',
  });
  assert.equal(governed.presentation.responseLength, 'brief');

  const modelOnly = realizeGovernedExpression({
    ...proposal,
    recommendation: 'responseLength: detailed',
  });
  assert.equal(modelOnly.presentation.responseLength, undefined);
});
