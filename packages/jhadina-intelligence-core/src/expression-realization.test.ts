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


test('preserves governed quip, banter and prosody as presentation-only assets', () => {
  const realized = realizeGovernedExpression(proposal, {
    mode: 'direct',
    allowProfanity: false,
    allowQuip: true,
    quip: {
      candidateId: 'q1',
      text: 'quick governed line',
      score: 0.9,
      truthReconnect: 'return to task truth',
    },
    banter: {
      bitId: 'bit-1',
      stage: 'twist',
      depth: 1,
      shouldReturnToTask: false,
    },
    prosodyGenome: {
      cadence: 0.5,
      microPauseDensity: 0.4,
      thoughtPauseDurationMs: 320,
      pitchRange: 0.6,
      pitchContour: 'dynamic',
      energy: 0.7,
      warmth: 0.8,
      groundedConfidence: 0.8,
      conversationality: 0.8,
      intimacy: 0.3,
      breathiness: 0.2,
      emphasis: 0.7,
      sentenceFinality: 0.6,
      spontaneity: 0.8,
      reactionIntensity: 0.7,
      playfulness: 0.9,
      operationalSass: 0.4,
      absurdEscalation: 0.5,
      poeticCompression: 0.4,
      storytellingIntensity: 0.2,
    },
  });

  assert.equal(realized.presentation.quip?.candidateId, 'q1');
  assert.equal(realized.presentation.banter?.stage, 'twist');
  assert.equal(realized.presentation.prosodyGenome?.pitchContour, 'dynamic');
  assert.deepEqual(realized.segments, [
    { kind: 'semantic', text: 'semantic answer' },
    { kind: 'quip', text: 'quick governed line', truthReconnect: 'return to task truth' },
  ]);
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

test('copies semantic presentation targets only from the governed directive', () => {
  const realized = realizeGovernedExpression(proposal, {
    mode: 'direct',
    allowProfanity: false,
    allowQuip: false,
    tone: 'warm',
    reasoningDepth: 'technical',
    interactionStyle: 'continuous',
    creativeStyle: 'experimental',
    explanationStyle: 'evidence-first',
    decisionPresentation: 'options',
  });
  assert.equal(realized.presentation.tone, 'warm');
  assert.equal(realized.presentation.reasoningDepth, 'technical');
  assert.equal(realized.presentation.interactionStyle, 'continuous');
  assert.equal(realized.presentation.creativeStyle, 'experimental');
  assert.equal(realized.presentation.explanationStyle, 'evidence-first');
  assert.equal(realized.presentation.decisionPresentation, 'options');

  const modelOnly = realizeGovernedExpression({
    ...proposal,
    recommendation: 'tone=formal interactionStyle=continuous creativeStyle=experimental',
  });
  assert.equal(modelOnly.presentation.tone, undefined);
  assert.equal(modelOnly.presentation.interactionStyle, undefined);
  assert.equal(modelOnly.presentation.creativeStyle, undefined);
});
