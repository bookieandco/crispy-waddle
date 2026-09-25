import {describe,expect,it} from 'vitest';
import {
  compileGenerationAudioIntent,
  validateGenerationAudioIntent,
} from './generation-audio-intent';

describe('generation audio intent',()=>{
  it('can explicitly request interview dialogue/sound design while forbidding baked-in music',()=>{
    const intent={
      id:'audio:int:interview',
      projectId:'p',
      sceneId:'scene:interview',
      allowedRoles:['dialogue','foley','sfx','ambience','nonverbal-vocalization'] as const,
      forbiddenRoles:['music'] as const,
      forbidUnrequestedMusic:true,
      notes:['Keep laughter and room sound natural between spoken lines.'],
      evidenceIds:['director:interview-plan'],
      authority:'DIRECTOR_GENERATION_AUDIO_INTENT' as const,
    };
    expect(validateGenerationAudioIntent(intent)).toEqual([]);
    const directive=compileGenerationAudioIntent(intent);
    expect(directive).toContain('Do not generate: music.');
    expect(directive).toContain('Do not introduce music');
  });

  it('rejects roles that are simultaneously allowed and forbidden',()=>{
    expect(validateGenerationAudioIntent({
      id:'bad',projectId:'p',sceneId:'s',
      allowedRoles:['dialogue','music'],
      forbiddenRoles:['music'],
      forbidUnrequestedMusic:true,
      notes:[],evidenceIds:['e'],
      authority:'DIRECTOR_GENERATION_AUDIO_INTENT',
    })).toContain('DIRECTOR_GENERATION_AUDIO_INTENT_ROLE_CONFLICT:music');
  });
});
