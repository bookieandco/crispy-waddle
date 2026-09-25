import {describe,expect,it,vi} from 'vitest';
import {translatePromptForModel,validateModelPromptProfile,type ModelPromptProfile} from './model-prompt-translation';

const profile:ModelPromptProfile={
  id:'prompt-profile:video-model:v1',
  providerId:'provider-1',
  modelId:'video-model',
  modelVersion:'1',
  documentationSources:[
    {
      id:'docs:prompt-basics',
      providerId:'provider-1',
      modelId:'video-model',
      modelVersion:'1',
      kind:'official-prompt-guide',
      uri:'https://provider.example/docs/video/prompting',
      sha256:'sha-docs-v1',
      capturedAt:'2026-09-25T00:00:00Z',
      evidenceIds:['docs-fetch:1'],
    },
  ],
  evidenceIds:['profile-review:1'],
  authority:'PROVIDER_PROMPT_PROFILE',
};

describe('model prompt translation',()=>{
  it('requires version-matched official documentation provenance',()=>{
    expect(validateModelPromptProfile(profile)).toEqual([]);
    expect(validateModelPromptProfile({
      ...profile,
      documentationSources:[{...profile.documentationSources[0]!,modelVersion:'2'}],
    })).toContain('DIRECTOR_PROMPT_SOURCE_MODEL_MISMATCH:docs:prompt-basics');
  });

  it('translates canonical intent without replacing the canonical prompt',async()=>{
    const translate=vi.fn(async(input=>({
      profileId:profile.id,
      providerId:profile.providerId,
      modelId:profile.modelId,
      modelVersion:profile.modelVersion,
      translatedPrompt:`MODEL OPTIMIZED: ${input.canonicalPrompt}`,
      canonicalPromptSha256:'sha-canonical',
      documentationSourceIds:['docs:prompt-basics'],
      evidenceIds:['translation:1'],
      authority:'PROVIDER_PROMPT_TRANSLATION' as const,
    })));
    const result=await translatePromptForModel({translate},profile,{
      projectId:'p',
      takeId:'take-1',
      canonicalPrompt:'Start close on her face, then pull back and orbit to reveal the ship.',
      creativeFeedback:['Make the performance emotionally subdued, not melodramatic.'],
    });
    expect(translate).toHaveBeenCalledWith(expect.objectContaining({
      canonicalPrompt:'Start close on her face, then pull back and orbit to reveal the ship.',
      creativeFeedback:['Make the performance emotionally subdued, not melodramatic.'],
    }),profile);
    expect(result.translatedPrompt).toContain('MODEL OPTIMIZED');
  });

  it('rejects translations that cite documentation outside the governed profile',async()=>{
    await expect(translatePromptForModel({
      async translate(){
        return {
          profileId:profile.id,providerId:profile.providerId,modelId:profile.modelId,modelVersion:profile.modelVersion,
          translatedPrompt:'optimized',canonicalPromptSha256:'sha',documentationSourceIds:['docs:unknown'],
          evidenceIds:['translation:bad'],authority:'PROVIDER_PROMPT_TRANSLATION' as const,
        };
      },
    },profile,{projectId:'p',takeId:'t',canonicalPrompt:'idea'})).rejects.toThrow('SOURCE_UNKNOWN');
  });
});
