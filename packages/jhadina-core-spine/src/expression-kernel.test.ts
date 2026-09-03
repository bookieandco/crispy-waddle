import assert from 'node:assert/strict';
import { planExpression } from './expression-kernel.js';
import type { BehavioralDecision } from './behavioral-kernel.js';

const decision: BehavioralDecision = {
  action: 'push_back',
  posture: {
    directness: 0.9,
    warmth: 0.7,
    humor: 0.8,
    profanityAllowed: true,
    quipsAllowed: true,
    disagreementDirectness: 0.6,
    authenticityRequired: true,
  },
  confidence: 0.6,
  reasons: ['test'],
};

describe('Expression Kernel', () => {
  it('maps behavioral action to an expression plan', () => {
    assert.deepEqual(planExpression(decision, { callback: 'callback-1', culturalReference: 'reference-1' }), {
      mode: 'pushback',
      allowProfanity: true,
      allowQuip: true,
      callback: 'callback-1',
      culturalReference: 'reference-1',
    });
  });

  it('never allows serious mode to re-enable profanity or quips', () => {
    const serious: BehavioralDecision = { ...decision, action: 'stay_serious' };
    const plan = planExpression(serious, { callback: 'should-not-quip' });
    assert.equal(plan.mode, 'serious');
    assert.equal(plan.allowProfanity, false);
    assert.equal(plan.allowQuip, false);
  });
});
