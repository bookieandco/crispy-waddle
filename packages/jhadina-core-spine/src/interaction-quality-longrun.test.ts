import { describe, expect, it } from 'vitest';
import {
  createSessionExpressionState,
  decideBehavior,
  emptyPersonalityState,
  markSessionBitUsed,
  planExpression,
  rememberSessionBit,
  updateSessionExpressionState,
  type ExpressionRegister,
} from './index.js';

describe('JHADINA-INTERACTION-QUALITY long conversation stability', () => {
  it('does not mutate durable Personality while registers and session bits change across 100 turns', () => {
    const personality = emptyPersonalityState('2026-09-23T00:00:00.000Z');
    personality.relationship = {
      ...personality.relationship!,
      familiarity: 1,
      calibrationConfidence: 1,
      preferredInteractionModes: ['direct', 'warm'],
    };
    const before = JSON.stringify(personality);
    const registers: ExpressionRegister[] = [
      'default',
      'playful',
      'storytelling',
      'reflective',
      'cultural-salon',
      'community-room',
      'threshold',
      'intimacy-agency',
      'household-ops',
    ];

    let session = createSessionExpressionState();
    session = rememberSessionBit(session, {
      id: 'longrun-bit',
      phrase: 'orientation crystals',
      origin: 'shared',
      createdAtTurn: 1,
    });

    for (let turn = 1; turn <= 100; turn += 1) {
      const register = registers[(turn - 1) % registers.length]!;
      session = updateSessionExpressionState(session, {
        userBuildingBit: turn % 4 === 0,
        discomfortDetected: turn % 17 === 0,
        conversationTemperature: (turn % 10) / 10,
        role: turn % 3 === 0 ? 'straight' : turn % 2 === 0 ? 'play' : 'balanced',
      });
      if (turn % 5 === 0) session = markSessionBitUsed(session, 'longrun-bit', turn);

      const decision = decideBehavior(personality, {
        register,
        banterEligible: register !== 'threshold' && register !== 'reflective',
        symbolicFramingEligible: register === 'threshold' || register === 'reflective',
        intimacyEligible: register === 'intimacy-agency',
        operationalContext: register === 'household-ops',
      });
      const expression = planExpression(decision, { session });

      expect(decision.posture.authenticityRequired).toBe(true);
      expect(expression.register).toBe(register);
      if (session.discomfortDetected) {
        expect(expression.bitDepth).toBe(0);
        expect(expression.affectionateTeasing).toBe(false);
      }
    }

    expect(session.bits[0]?.durable).toBe(false);
    expect(JSON.stringify(personality)).toBe(before);
  });
});
