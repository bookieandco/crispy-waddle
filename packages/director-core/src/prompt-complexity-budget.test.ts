import {describe,expect,it} from 'vitest';
import {evaluatePromptComplexity} from './prompt-complexity-budget';

const profile={
  id:'prompt-profile:video-model-v1',
  providerId:'provider',
  modelId:'video-model',
  modelVersion:'v1',
  hardMaxDurationSeconds:15,
  recommendedMaximumPromptCharacters:2400,
  recommendedMaximumInstructionCount:18,
  recommendedMaximumReferenceCount:8,
  recommendedMaximumConcurrentCameraMoves:2,
  measuredAt:'2026-09-25T00:00:00Z',
  evidenceIds:['experiment:prompt-envelope'],
  authority:'PROVIDER_PROMPT_COMPLEXITY_PROFILE' as const,
};

describe('prompt complexity budget',()=>{
  it('warns above a measured envelope without pretending the envelope is a universal hard limit',()=>{
    const decision=evaluatePromptComplexity(profile,{
      projectId:'p',takeId:'take:1',promptCharacters:2600,instructionCount:20,
      referenceCount:9,concurrentCameraMoveCount:3,targetDurationSeconds:12,
      evidenceIds:['prompt:compiled'],
    });
    expect(decision.admissible).toBe(true);
    expect(decision.warnings).toEqual(expect.arrayContaining([
      'DIRECTOR_PROMPT_COMPLEXITY_ABOVE_MEASURED_ENVELOPE:PROMPT_CHARACTERS',
      'DIRECTOR_PROMPT_COMPLEXITY_ABOVE_MEASURED_ENVELOPE:REFERENCE_COUNT',
    ]));
  });

  it('fails only a documented hard model duration cap',()=>{
    const decision=evaluatePromptComplexity(profile,{
      projectId:'p',takeId:'take:2',promptCharacters:1000,instructionCount:8,
      referenceCount:4,concurrentCameraMoveCount:1,targetDurationSeconds:16,
      evidenceIds:['prompt:compiled'],
    });
    expect(decision.admissible).toBe(false);
    expect(decision.errors).toContain('DIRECTOR_PROMPT_COMPLEXITY_DURATION_EXCEEDS_MODEL_MAX');
  });
});
