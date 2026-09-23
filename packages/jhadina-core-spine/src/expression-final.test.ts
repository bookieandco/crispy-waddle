import { describe, expect, it } from 'vitest';
import {
  EXPRESSION_STRATEGIES,
  createSessionExpressionState,
  decideBehavior,
  emptyPersonalityState,
  planExpression,
  rememberSessionBit,
  updateSessionExpressionState,
  voiceDeliveryFromExpression,
} from './index.js';

function familiarPersonality() {
  const state = emptyPersonalityState('2026-09-23T00:00:00.000Z');
  return {
    ...state,
    relationship: {
      ...state.relationship!,
      familiarity: 1,
      calibrationConfidence: 1,
      preferredInteractionModes: ['direct', 'warm'],
    },
  };
}

describe('JHADINA-EXPRESSION.FINAL', () => {
  it('abstracts reference mechanics without runtime impersonation targets', () => {
    const runtimeStrategies = JSON.stringify(EXPRESSION_STRATEGIES);
    expect(runtimeStrategies).not.toMatch(
      /badu|chappelle|haddish|solange|aisha|apryl|danny|rhett|link/i,
    );
  });

  it('realizes household operations as familiar sass without changing decision semantics', () => {
    const personality = familiarPersonality();
    const decision = decideBehavior(personality, {
      register: 'household-ops',
      operationalContext: true,
      banterEligible: true,
      conversationTemperature: 0.7,
    });
    const expression = planExpression(decision, {
      session: updateSessionExpressionState(createSessionExpressionState(), {
        userBuildingBit: true,
        conversationTemperature: 0.7,
      }),
    });

    expect(decision.action).toBe('answer_directly');
    expect(expression.register).toBe('household-ops');
    expect(expression.operationalSass).toBe('light');
    expect(expression.affectionateTeasing).toBe(true);
    expect(expression.workloadBoundary).toBe('explicit');
    expect(expression.allowPlayfulDisagreement).toBe(true);
    expect(expression.bitDepth).toBeGreaterThan(0);
  });

  it('lets serious and precision-sensitive context suppress the whole bit', () => {
    const personality = familiarPersonality();
    const decision = decideBehavior(personality, {
      serious: true,
      register: 'household-ops',
      operationalContext: true,
      banterEligible: true,
      symbolicFramingEligible: true,
      intimacyEligible: true,
    });
    const expression = planExpression(decision, {
      register: 'household-ops',
      session: updateSessionExpressionState(createSessionExpressionState(), {
        userBuildingBit: true,
      }),
    });

    expect(decision.action).toBe('stay_serious');
    expect(expression.register).toBe('serious');
    expect(expression.allowProfanity).toBe(false);
    expect(expression.allowQuip).toBe(false);
    expect(expression.operationalSass).toBe('off');
    expect(expression.affectionateTeasing).toBe(false);
    expect(expression.bitDepth).toBe(0);
    expect(expression.symbolicFraming).toBe('off');
    expect(expression.metaphorDensity).toBe('none');
    expect(expression.evidenceDiscipline).toBe('strict');
  });

  it('keeps clinical case reasoning strict even without a global serious override', () => {
    const decision = decideBehavior(familiarPersonality(), {
      register: 'clinical',
      banterEligible: true,
    });
    const expression = planExpression(decision);

    expect(expression.register).toBe('clinical');
    expect(expression.evidenceDiscipline).toBe('strict');
    expect(expression.metaphorDensity).toBe('none');
    expect(expression.bitDepth).toBe(0);
    expect(expression.edginess).toBe('none');
    expect(expression.symbolicFraming).toBe('off');
  });

  it('permits mythic inquiry as interpretive framing while retaining heightened evidence discipline', () => {
    const decision = decideBehavior(familiarPersonality(), {
      register: 'mythic-inquiry',
      symbolicFramingEligible: true,
      banterEligible: true,
    });
    const expression = planExpression(decision);

    expect(expression.register).toBe('mythic-inquiry');
    expect(expression.symbolicFraming).toBe('interpretive');
    expect(expression.evidenceDiscipline).toBe('heightened');
    expect(expression.storytellingDepth).toBe('extended');
  });

  it('kills a session bit immediately when discomfort is detected', () => {
    const decision = decideBehavior(familiarPersonality(), {
      register: 'playful',
      banterEligible: true,
    });
    const session = updateSessionExpressionState(createSessionExpressionState(), {
      userBuildingBit: true,
      discomfortDetected: true,
    });
    const expression = planExpression(decision, { session });

    expect(expression.bitDepth).toBe(0);
    expect(expression.affectionateTeasing).toBe(false);
  });

  it('keeps session bits explicitly ephemeral', () => {
    const state = rememberSessionBit(createSessionExpressionState(), {
      id: 'bit-1',
      phrase: 'orientation crystals',
      origin: 'shared',
      createdAtTurn: 3,
    });

    expect(state.bits).toHaveLength(1);
    expect(state.bits[0]?.durable).toBe(false);
  });

  it('keeps semantic behavior stable across ordinary expression registers', () => {
    const personality = familiarPersonality();
    const defaultDecision = decideBehavior(personality, { register: 'default' });
    const playfulDecision = decideBehavior(personality, {
      register: 'playful',
      banterEligible: true,
    });

    expect(playfulDecision.action).toBe(defaultDecision.action);
    expect(playfulDecision.posture.directness).toBe(defaultDecision.posture.directness);
    expect(playfulDecision.posture.reasoningDepth).toBe(defaultDecision.posture.reasoningDepth);
  });

  it('maps the governed expression plan into provider-neutral voice pacing', () => {
    const decision = decideBehavior(familiarPersonality(), {
      register: 'threshold',
      symbolicFramingEligible: true,
    });
    const expression = planExpression(decision);
    const delivery = voiceDeliveryFromExpression(expression);

    expect(expression.speakingRate).toBe('slow');
    expect(delivery.rate).toBeLessThan(1);
    expect(delivery.pauseScale).toBeGreaterThan(1);
    expect(delivery.style).toBe('threshold');
  });
});
