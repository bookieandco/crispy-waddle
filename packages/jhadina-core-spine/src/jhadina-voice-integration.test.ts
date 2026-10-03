import {describe,it,expect} from 'vitest';
import {
  admitRecurringCallback,
  assessCallbackCandidate,
  buildPersonalityBehaviorExpressionPlan,
  canonicalJhadinaSurfaceVoice,
  createSessionExpressionState,
  emptyPersonalityState,
  projectPersonality,
  selectEvidenceBackedCallback,
  updateSessionExpressionState,
  type MemoryProposal,
} from './index.js';

function memory(
  id:string,
  evidenceId:string,
  content:string,
  observedAt:string,
):MemoryProposal{
  return {
    id,
    content,
    reason:'approved durable memory',
    disposition:'SAVE',
    evidence:[{
      id:evidenceId,
      source:'memory',
      observedAt,
      summary:content,
      immutable:true,
    }],
  };
}

describe('JHADINA-VOICE.11 memory/personality/expression/voice integration',()=>{
  it('admits repeated callback evidence, speaks it, then revokes it when correction/forget removes support',()=>{
    const first=memory(
      'mem-red-chair-1',
      'reason-red-chair-1',
      'We used the red chair joke again.',
      '2026-10-01T10:00:00.000Z',
    );
    const second=memory(
      'mem-red-chair-2',
      'reason-red-chair-2',
      'The red chair joke came back naturally.',
      '2026-10-02T10:00:00.000Z',
    );

    const candidate=assessCallbackCandidate({
      callback:'red chair',
      memories:[first,second],
    });
    expect(candidate.eligible).toBe(true);

    const admitted=admitRecurringCallback(
      emptyPersonalityState('2026-10-03T00:00:00.000Z'),
      candidate,
      '2026-10-03T00:01:00.000Z',
    );
    expect(admitted.relationship?.callbackEvidence?.[0]?.evidence.map(ref=>ref.id))
      .toEqual(['reason-red-chair-1','reason-red-chair-2']);

    const verified=selectEvidenceBackedCallback({
      personality:admitted,
      callback:'red chair',
    });
    expect(verified?.value).toBe('red chair');

    const playful=buildPersonalityBehaviorExpressionPlan(admitted,{
      callback:verified,
      register:'playful',
    });
    expect(playful.expression.callback).toBe('red chair');

    // Simulate correction/forget: one old memory is no longer APPROVED.
    // The replacement memory has new content and therefore cannot support the old callback.
    const corrected=memory(
      'mem-corrected',
      'reason-corrected',
      'Correction: there is no recurring red furniture joke.',
      '2026-10-03T01:00:00.000Z',
    );
    const reconciled=projectPersonality(
      admitted,
      [],
      [second,corrected],
      '2026-10-03T01:01:00.000Z',
      undefined,
      undefined,
      new Set(['reason-red-chair-2','reason-corrected']),
    );

    expect(reconciled.relationship?.recurringCallbacks).toEqual([]);
    expect(reconciled.relationship?.callbackEvidence).toEqual([]);
    expect(selectEvidenceBackedCallback({
      personality:reconciled,
      callback:'red chair',
      memories:[second,corrected],
    })).toBeUndefined();
  });

  it('keeps a successful playful bit ephemeral and leaves the semantic task path intact',()=>{
    const session=updateSessionExpressionState(createSessionExpressionState(),{
      userBuildingBit:true,
      conversationTemperature:0.85,
    });
    const personality=emptyPersonalityState('2026-10-03T02:00:00.000Z');
    const plan=buildPersonalityBehaviorExpressionPlan(personality,{
      register:'playful',
      session,
      quipCandidates:[{
        id:'quip-1',
        text:'That bug came in wearing a fake mustache.',
        naturalness:1,
        timing:1,
        contextFit:1,
        relationshipFit:0.8,
        personalityFit:1,
        truthCompatibility:1,
        truthReconnect:'Back to the actual fix.',
      }],
      banterInput:{
        turn:1,
        bitId:'bit-fake-mustache',
        phrase:'fake mustache',
        origin:'shared',
        strategyCap:2,
      },
    });

    expect(plan.decision.action).toBe('answer_directly');
    expect(plan.quip?.candidateId).toBe('quip-1');
    expect(plan.banterTransition?.runtime.stage).toBe('notice');
    expect(plan.banterTransition?.session.bits[0]?.durable).toBe(false);
    expect(plan.expression.quip?.truthReconnect).toBe('Back to the actual fix.');
  });

  it('forces the complete serious posture even when playful artifacts are supplied',()=>{
    const base=emptyPersonalityState('2026-10-03T03:00:00.000Z');
    const evidence={
      id:'callback-serious-1',
      source:'conversation',
      observedAt:'2026-10-01T03:00:00.000Z',
      summary:'red chair callback was shared',
      immutable:true,
    };
    const personality={
      ...base,
      relationship:{
        ...base.relationship!,
        familiarity:0.9,
        calibrationConfidence:0.9,
        recurringCallbacks:['red chair'],
        callbackEvidence:[{callback:'red chair',evidence:[evidence,evidence]}],
      },
    };
    // Use the selector only as a verified input gate; serious mode must suppress it downstream.
    const callback=selectEvidenceBackedCallback({
      personality,
      callback:'red chair',
    });
    expect(callback).toBeDefined();

    const session=updateSessionExpressionState(createSessionExpressionState(),{
      userBuildingBit:true,
      conversationTemperature:1,
    });
    const plan=buildPersonalityBehaviorExpressionPlan(personality,{
      highStakes:true,
      callback,
      register:'playful',
      session,
      quipCandidates:[{
        id:'quip-serious',
        text:'should never survive',
        naturalness:1,
        timing:1,
        contextFit:1,
        relationshipFit:1,
        personalityFit:1,
        truthCompatibility:1,
      }],
      banterInput:{
        turn:1,
        bitId:'bit-serious',
        phrase:'should never run',
        origin:'shared',
        strategyCap:3,
      },
    });

    expect(plan.decision.action).toBe('stay_serious');
    expect(plan.quip).toBeUndefined();
    expect(plan.banterTransition?.runtime.stage).toBe('exit');
    expect(plan.expression.mode).toBe('serious');
    expect(plan.expression.allowProfanity).toBe(false);
    expect(plan.expression.allowQuip).toBe(false);
    expect(plan.expression.callback).toBeUndefined();
    expect(plan.expression.bitDepth).toBe(0);
    expect(plan.expression.operationalSass).toBe('off');
    expect(plan.expression.affectionateTeasing).toBe(false);
    expect(plan.expression.prosodyGenome?.playfulness).toBe(0);
    expect(plan.expression.prosodyGenome?.absurdEscalation).toBe(0);
  });

  it('changes expression without changing who Jhadina is acoustically',()=>{
    const ask=canonicalJhadinaSurfaceVoice({
      surface:'ask',
      purpose:'playful live answer',
      expressionProfileRef:'brand-voice:jhadina',
    });
    const tv=canonicalJhadinaSurfaceVoice({
      surface:'tv',
      purpose:'cinematic narration',
      expressionProfileRef:'brand-voice:jhadinatv',
    });
    const music=canonicalJhadinaSurfaceVoice({
      surface:'music',
      purpose:'music-native commentary',
      expressionProfileRef:'brand-voice:jhadina-music',
    });

    expect(new Set([
      ask.speakerIdentityRef,
      tv.speakerIdentityRef,
      music.speakerIdentityRef,
    ])).toEqual(new Set(['voice:jhadina:canonical:v1']));
    expect(new Set([
      ask.expressionProfileRef,
      tv.expressionProfileRef,
      music.expressionProfileRef,
    ]).size).toBe(3);
  });

  it('suppresses an unsupported callback instead of manufacturing shared history',()=>{
    const personality=emptyPersonalityState('2026-10-03T04:00:00.000Z');
    expect(selectEvidenceBackedCallback({
      personality,
      callback:'we always do this',
    })).toBeUndefined();
  });
});
