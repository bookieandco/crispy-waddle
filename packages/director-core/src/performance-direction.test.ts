import { describe, expect, it } from 'vitest';
import {
  assertPerformanceDirectionPlan,
  compilePerformanceDirective,
  validatePerformanceDirectionPlan,
  type PerformanceDirectionPlan,
} from './performance-direction.js';

function plan(): PerformanceDirectionPlan {
  return {
    version: 1,
    sceneFunction: 'turn a fragile apology into open conflict',
    continuousTake: true,
    actors: [
      { actorId: 'man', startingState: 'unsteady and ashamed', endingState: 'stopped mid-apology' },
      { actorId: 'woman', startingState: 'contained anger', endingState: 'jaw clenched after interrupting him' },
    ],
    beats: [
      {
        id: 'walk-out',
        kind: 'blocking',
        actorId: 'man',
        action: 'walk out of the bedroom beside the woman into the living room',
        energy: 'restrained',
      },
      {
        id: 'apology',
        kind: 'dialogue',
        actorId: 'man',
        action: 'struggle to get the words out with wet eyes and loose posture',
        emotionalState: 'ashamed and overwhelmed',
        line: "I'm sorry. I don't know what to say.",
        pace: 'slow',
        energy: 'low',
        endState: 'mid-sentence and glassy-eyed',
      },
      {
        id: 'interrupt',
        kind: 'reaction',
        actorId: 'woman',
        trigger: 'the apology stalls',
        action: 'cut him off sharply',
        emotionalState: 'anger breaking through restraint',
        bodyState: 'jaw clenched and shoulders tight',
        endState: 'facing him with the interruption landed',
      },
    ],
    preserve: ['identity', 'timing'],
  };
}

describe('performance direction', () => {
  it('compiles dialogue, action, emotion and end-state as observable beats', () => {
    const text = compilePerformanceDirective(plan());
    expect(text).toContain('turn a fragile apology into open conflict');
    expect(text).toContain('say exactly: "I\'m sorry. I don\'t know what to say."');
    expect(text).toContain('emotion ashamed and overwhelmed');
    expect(text).toContain('end state mid-sentence and glassy-eyed');
  });

  it('rejects dialogue beats without exact dialogue', () => {
    const invalid = plan();
    invalid.beats[1] = { ...invalid.beats[1]!, line: '' };
    expect(validatePerformanceDirectionPlan(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DIALOGUE_LINE_REQUIRED' }),
    ]));
    expect(() => assertPerformanceDirectionPlan(invalid)).toThrow('DIRECTOR_PERFORMANCE_PLAN_INVALID');
  });

  it('rejects triggered beats with no observable response', () => {
    const invalid = plan();
    invalid.beats.push({ id: 'bad-trigger', kind: 'reaction', trigger: 'a loud bang', endState: 'frozen' });
    expect(validatePerformanceDirectionPlan(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TRIGGER_WITHOUT_ACTION' }),
    ]));
  });
});
