import {describe,expect,it} from 'vitest';
import {evaluateSceneGenerationAttempt} from './scene-attempt-budget';

describe('scene attempt budget',()=>{
  const budget={
    id:'attempts:scene-1',
    projectId:'p',
    sceneId:'scene:1',
    recommendedMinimumAttempts:1,
    recommendedMaximumAttempts:2,
    hardMaximumAttempts:5,
    stopWhenAccepted:true,
    evidenceIds:['producer:budget-plan'],
    authority:'DIRECTOR_SCENE_ATTEMPT_BUDGET' as const,
  };

  it('treats one-to-two attempts as guidance rather than a universal hard rule',()=>{
    expect(evaluateSceneGenerationAttempt(budget,2)).toMatchObject({allowed:true,warnings:[]});
    expect(evaluateSceneGenerationAttempt(budget,3)).toMatchObject({
      allowed:true,
      warnings:['DIRECTOR_SCENE_ATTEMPT_ABOVE_RECOMMENDED_RANGE'],
    });
  });

  it('blocks only the explicit project hard maximum',()=>{
    expect(evaluateSceneGenerationAttempt(budget,6)).toMatchObject({
      allowed:false,
      reasons:expect.arrayContaining(['DIRECTOR_SCENE_ATTEMPT_HARD_MAX_EXCEEDED']),
    });
  });
});
