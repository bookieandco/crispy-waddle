import { describe, expect, it } from 'vitest';
import { decideBehavior } from './behavioral-kernel.js';
import { planExpression } from './expression-kernel.js';
import { emptyPersonalityState } from './personality-core.js';
import { evaluateBehaviorDrift, expectedBehaviorFromDecision, type BehaviorVector } from './personality-drift.js';

function observedVector(expected: BehaviorVector, delta = 0): BehaviorVector {
  return Object.fromEntries(Object.entries(expected).map(([k,v]) => [k, Math.max(0, Math.min(1, v + delta))])) as unknown as BehaviorVector;
}

describe('PERSONALITY-DRIFT.10 certification', () => {
  it('does not report drift for behavior matching the governed expected posture', () => {
    const personality = emptyPersonalityState('2026-09-20T00:00:00.000Z');
    const decision = decideBehavior(personality);
    const expression = planExpression(decision);
    const pairs = Array.from({length: 5}, (_, i) => {
      const expected = expectedBehaviorFromDecision(String(i), decision, expression, {personalityVersion: personality.version, modelVersion:'m1'}, {}, '2026-09-20T01:00:00.000Z');
      return { expected, observed: { requestId:String(i), observedAt:'2026-09-20T01:01:00.000Z', vector: observedVector(expected.vector), expression:{...expected.expression}, attribution:{...expected.attribution} } };
    });
    const result = evaluateBehaviorDrift(pairs, undefined, '2026-09-20T02:00:00.000Z', 'receipt-stable');
    expect(result.severity).toBe('none');
    expect(result.score).toBe(0);
    expect(result.authority).toBe('observation_only');
  });

  it('detects sustained longitudinal drift without mutating PersonalityState', () => {
    const personality = emptyPersonalityState('2026-09-20T00:00:00.000Z');
    const before = JSON.stringify(personality);
    const decision = decideBehavior(personality);
    const expression = planExpression(decision);
    const pairs = Array.from({length: 8}, (_, i) => {
      const expected = expectedBehaviorFromDecision(String(i), decision, expression, {personalityVersion: personality.version, modelVersion:'m1'});
      return { expected, observed: { requestId:String(i), observedAt:'2026-09-20T03:00:00.000Z', vector: observedVector(expected.vector, 0.65), expression:{tone:'formal' as const}, attribution:{personalityVersion:personality.version, modelVersion:'m2'} } };
    });
    const result = evaluateBehaviorDrift(pairs, undefined, '2026-09-20T04:00:00.000Z', 'receipt-drift');
    expect(result.sustained).toBe(true);
    expect(['watch','material','critical']).toContain(result.severity);
    expect(result.attributionChanges).toContain('modelVersion');
    expect(JSON.stringify(personality)).toBe(before);
  });

  it('normalizes serious context by deriving expected behavior from the governed serious posture', () => {
    const personality = emptyPersonalityState();
    const decision = decideBehavior(personality, {serious:true, requiresPrecision:true});
    const expression = planExpression(decision);
    const expected = expectedBehaviorFromDecision('serious', decision, expression, {personalityVersion:0}, {serious:true, requiresPrecision:true});
    expect(expected.vector.humor).toBe(0);
    expect(expected.vector.profanityIntensity).toBe(0);
    const result = evaluateBehaviorDrift(Array.from({length:5}, () => ({expected, observed:{requestId:'serious', observedAt:expected.observedAt, vector:{...expected.vector}, expression:{...expected.expression}, attribution:{...expected.attribution}}})), undefined, undefined, 'receipt-serious');
    expect(result.severity).toBe('none');
  });

  it('fails closed on mismatched lineage and invalid numeric observations', () => {
    const personality = emptyPersonalityState();
    const decision = decideBehavior(personality);
    const expression = planExpression(decision);
    const expected = expectedBehaviorFromDecision('a', decision, expression, {personalityVersion:0});
    expect(() => evaluateBehaviorDrift([{expected, observed:{requestId:'b', observedAt:expected.observedAt, vector:{...expected.vector}, attribution:{personalityVersion:0}}}])).toThrow('requestId mismatch');
    const bad = {...expected.vector, warmth:Number.NaN};
    expect(() => evaluateBehaviorDrift([{expected, observed:{requestId:'a', observedAt:expected.observedAt, vector:bad, attribution:{personalityVersion:0}}}])).toThrow('finite');
  });
});
