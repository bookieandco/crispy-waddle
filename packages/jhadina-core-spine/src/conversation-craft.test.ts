import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { selectQuip } from './quip-engine.js';
import { advanceBanterBit } from './banter-bit-engine.js';
import { assessCallbackCandidate, admitRecurringCallback, retireRecurringCallback } from './callback-learning.js';
import { selectEvidenceBackedCallback } from './callback-provenance.js';
import { buildPersonalityBehaviorExpressionPlan } from './personality-behavior-expression.js';
import { createSessionExpressionState, updateSessionExpressionState } from './session-expression.js';
import { planExpression } from './expression-kernel.js';
import { voiceDeliveryFromExpression } from './voice-runtime.js';
import type { BehavioralDecision } from './behavioral-kernel.js';
import type { Experience, PersonalityState } from './types.js';
import { encodeHippocampalEpisode } from './hippocampus.js';

function decision(overrides: Partial<BehavioralDecision['posture']> = {}): BehavioralDecision {
  return {
    action: 'answer_directly',
    confidence: 0.8,
    reasons: ['test'],
    posture: {
      directness: 0.8,
      warmth: 0.72,
      verbosity: 0.45,
      formality: 0.45,
      reasoningDepth: 0.55,
      workflowContinuity: 0.7,
      explanationStyle: 'standard',
      decisionPresentation: 'balanced',
      humor: 0.8,
      profanityAllowed: true,
      profanityIntensity: 0.55,
      quipsAllowed: true,
      quipIntensity: 0.7,
      disagreementDirectness: 0.8,
      relationshipFamiliarity: 0.8,
      relationshipCalibration: 0.75,
      preferredInteractionModes: ['direct'],
      creativeLatitude: 0.65,
      conventionTolerance: 0.4,
      register: 'playful',
      lyricality: 0.45,
      poeticCompression: 0.55,
      cadenceSpaciousness: 0.5,
      emotionalIntimacy: 0.65,
      resilienceHumor: 0.75,
      absurdEscalation: 0.6,
      callbackAffinity: 0.7,
      conceptualPlayfulness: 0.72,
      culturalFluency: 0.75,
      selfAuthorship: 0.7,
      gracefulRelease: 0.55,
      ordinaryEnchantment: 0.45,
      operationalSass: 0.6,
      affectionateTeasing: 0.7,
      protocolPushback: 0.8,
      edginessBudget: 0.6,
      symbolicFramingAllowed: false,
      intimacyEligible: true,
      banterEligible: true,
      conversationTemperature: 0.7,
      workloadPressure: 0.1,
      authenticityRequired: true,
      ...overrides,
    },
  };
}

function personality(): PersonalityState {
  return {
    version: 1,
    traits: [],
    voice: {
      directness: 0.7,
      warmth: 0.6,
      humor: 0.7,
      profanityTolerance: 0.6,
      quipFrequency: 0.35,
      verbosity: 0.55,
      disagreementDirectness: 0.8,
    },
    relationship: {
      familiarity: 0.8,
      calibrationConfidence: 0.8,
      preferredInteractionModes: [],
      recurringCallbacks: [],
      evidence: [],
    },
    independentAssessmentRequired: true,
    updatedAt: '2026-10-03T00:00:00.000Z',
  };
}

describe('Jhadina conversation craft', () => {
  it('selects a strong quip but allows a no-quip outcome', () => {
    const selected = selectQuip(decision(), {
      candidates: [
        {
          id: 'weak',
          text: 'forced',
          naturalness: 0.3,
          timing: 0.3,
          contextFit: 0.4,
          relationshipFit: 0.4,
          personalityFit: 0.4,
          truthCompatibility: 0.8,
          taskInterruptionCost: 0.9,
        },
        {
          id: 'strong',
          text: 'clean quick line',
          naturalness: 0.95,
          timing: 0.95,
          contextFit: 0.95,
          relationshipFit: 0.8,
          personalityFit: 0.9,
          truthCompatibility: 1,
          truthReconnect: 'back to the actual point',
        },
      ],
    });
    assert.equal(selected?.candidateId, 'strong');
    assert.equal(selected?.truthReconnect, 'back to the actual point');

    const none = selectQuip(decision(), {
      minimumScore: 0.9,
      candidates: [{
        id: 'mid',
        text: 'not good enough',
        naturalness: 0.5,
        timing: 0.5,
        contextFit: 0.5,
        relationshipFit: 0.5,
        personalityFit: 0.5,
        truthCompatibility: 0.6,
      }],
    });
    assert.equal(none, undefined);
  });

  it('suppresses quips in serious posture and on discomfort', () => {
    const candidate = [{
      id: 'q',
      text: 'nope',
      naturalness: 1,
      timing: 1,
      contextFit: 1,
      relationshipFit: 1,
      personalityFit: 1,
      truthCompatibility: 1,
    }];
    assert.equal(selectQuip({ ...decision(), action: 'stay_serious' }, { candidates: candidate }), undefined);
    const session = updateSessionExpressionState(createSessionExpressionState(), { discomfortDetected: true });
    assert.equal(selectQuip(decision(), { candidates: candidate, session }), undefined);
  });

  it('keeps ordinary banter short and exits immediately on discomfort', () => {
    const base = createSessionExpressionState();
    const first = advanceBanterBit(base, undefined, {
      turn: 1,
      bitId: 'bit-1',
      phrase: 'red chair',
      origin: 'shared',
      humor: 0.8,
      strategyCap: 2,
    });
    assert.equal(first.runtime.stage, 'notice');
    const second = advanceBanterBit(first.session, first.runtime, {
      turn: 2,
      bitId: 'bit-1',
      phrase: 'red chair',
      origin: 'shared',
      humor: 0.8,
      strategyCap: 2,
    });
    assert.equal(second.runtime.stage, 'twist');
    const third = advanceBanterBit(second.session, second.runtime, {
      turn: 3,
      bitId: 'bit-1',
      phrase: 'red chair',
      origin: 'shared',
      humor: 0.8,
      strategyCap: 2,
    });
    assert.equal(third.runtime.stage, 'exit');
    assert.equal(third.shouldReturnToTask, true);

    const uncomfortable = updateSessionExpressionState(base, { discomfortDetected: true });
    const stopped = advanceBanterBit(uncomfortable, undefined, {
      turn: 1,
      bitId: 'bit-stop',
      phrase: 'stop',
      origin: 'jhadina',
      humor: 1,
      strategyCap: 3,
    });
    assert.equal(stopped.runtime.stage, 'exit');
    assert.equal(stopped.runtime.depth, 0);
  });

  it('requires independent immutable evidence before a callback becomes relationship lore', () => {
    const one: Experience = {
      id: 'episode-1',
      occurredAt: '2026-10-01T00:00:00.000Z',
      source: 'conversation',
      actor: 'user',
      content: 'We used the red chair joke again.',
      evidence: [],
    };
    const duplicate: Experience = { ...one };
    const two: Experience = {
      ...one,
      id: 'episode-2',
      occurredAt: '2026-10-02T00:00:00.000Z',
      actor: 'jhadina',
      content: 'The red chair joke came back naturally.',
    };

    const insufficient = assessCallbackCandidate({
      callback: 'red chair',
      episodes: [encodeHippocampalEpisode(one), encodeHippocampalEpisode(duplicate)],
    });
    assert.equal(insufficient.eligible, false);
    assert.equal(insufficient.independentEvidenceCount, 1);

    const candidate = assessCallbackCandidate({
      callback: 'red chair',
      episodes: [encodeHippocampalEpisode(one), encodeHippocampalEpisode(two)],
    });
    assert.equal(candidate.eligible, true);
    const admitted = admitRecurringCallback(personality(), candidate, '2026-10-03T00:00:00.000Z');
    assert.deepEqual(admitted.relationship?.recurringCallbacks, ['red chair']);
    assert.equal(admitted.relationship?.evidence.length, 2);

    const available = selectEvidenceBackedCallback({
      personality: admitted,
      callback: 'red chair',
      now: '2026-10-03T12:00:00.000Z',
      usage: [{ callback: 'red chair', lastUsedAt: '2026-10-03T11:00:00.000Z', usesWithinWindow: 1 }],
    });
    assert.ok(available);
    const fatigued = selectEvidenceBackedCallback({
      personality: admitted,
      callback: 'red chair',
      now: '2026-10-03T12:00:00.000Z',
      usage: [{ callback: 'red chair', lastUsedAt: '2026-10-03T11:00:00.000Z', usesWithinWindow: 2 }],
    });
    assert.equal(fatigued, undefined);

    const retired = retireRecurringCallback(admitted, 'red chair', '2026-10-04T00:00:00.000Z');
    assert.deepEqual(retired.relationship?.recurringCallbacks, []);
  });

  it('runs quip and banter craft inside the personality-to-expression vertical slice', () => {
    const session = updateSessionExpressionState(createSessionExpressionState(), { userBuildingBit: true });
    const plan = buildPersonalityBehaviorExpressionPlan(personality(), {
      register: 'playful',
      banterEligible: true,
      conversationTemperature: 0.8,
      session,
      quipCandidates: [{
        id: 'vertical-quip',
        text: 'quick reaction',
        naturalness: 1,
        timing: 1,
        contextFit: 1,
        relationshipFit: 0.8,
        personalityFit: 1,
        truthCompatibility: 1,
      }],
      banterInput: {
        turn: 1,
        bitId: 'vertical-bit',
        phrase: 'shared bit',
        origin: 'shared',
        strategyCap: 2,
      },
    });

    assert.equal(plan.quip?.candidateId, 'vertical-quip');
    assert.equal(plan.expression.quip?.candidateId, 'vertical-quip');
    assert.equal(plan.banterTransition?.runtime.stage, 'notice');
    assert.equal(plan.expression.banter?.bitId, 'vertical-bit');
    assert.ok(plan.expression.prosodyGenome);
  });

  it('projects the full prosody genome into TTS and kills playful delivery in serious mode', () => {
    const playful = planExpression(decision());
    assert.ok(playful.prosodyGenome);
    assert.ok((playful.prosodyGenome?.playfulness ?? 0) > 0);
    const delivery = voiceDeliveryFromExpression(playful);
    assert.equal(delivery.playfulness, playful.prosodyGenome?.playfulness);
    assert.equal(delivery.pitchContour, playful.prosodyGenome?.pitchContour);
    assert.ok((delivery.thoughtPauseDurationMs ?? 0) > 0);

    const serious = planExpression({ ...decision(), action: 'stay_serious' });
    assert.equal(serious.allowQuip, false);
    assert.equal(serious.prosodyGenome?.playfulness, 0);
    assert.equal(serious.prosodyGenome?.operationalSass, 0);
    assert.equal(serious.prosodyGenome?.absurdEscalation, 0);
    assert.equal(serious.prosodyGenome?.pitchContour, 'level');
  });
});
