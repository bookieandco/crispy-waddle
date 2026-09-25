import {describe,expect,it} from 'vitest';
import {DIALOGUE_FIRST_MIX_PROFILE,validateAudioPriorityMixPlan} from './audio-priority-mix';

describe('audio priority mix',()=>{
  it('keeps dialogue above music and effects without hard-coding one gain target',()=>{
    expect(validateAudioPriorityMixPlan(DIALOGUE_FIRST_MIX_PROFILE)).toEqual([]);
    expect(DIALOGUE_FIRST_MIX_PROFILE.priorityOrder.slice(0,3)).toEqual(['dialogue','music','foley']);
    expect(DIALOGUE_FIRST_MIX_PROFILE.rules[0]).toMatchObject({
      higherPriority:'dialogue',
      lowerPriority:'music',
      whenOverlapping:'duck-lower',
    });
  });

  it('rejects a rule that contradicts the declared priority order',()=>{
    expect(validateAudioPriorityMixPlan({
      ...DIALOGUE_FIRST_MIX_PROFILE,
      id:'bad',
      projectId:'p',
      rules:[{
        higherPriority:'music',
        lowerPriority:'dialogue',
        whenOverlapping:'duck-lower',
        rationale:'bad ordering',
        evidenceIds:['test'],
      }],
    })).toContain('DIRECTOR_AUDIO_PRIORITY_RULE_ORDER_CONFLICT:0');
  });
});
