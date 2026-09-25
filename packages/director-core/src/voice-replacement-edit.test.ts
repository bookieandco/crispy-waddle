import {describe,expect,it} from 'vitest';
import {validateVoiceReplacementEditPlan} from './voice-replacement-edit';

describe('voice replacement edit',()=>{
  it('replaces speech while explicitly preserving laughter footsteps and room sound',()=>{
    expect(validateVoiceReplacementEditPlan({
      id:'voice-edit:raven-interview',
      projectId:'p',
      characterId:'raven',
      voiceIdentityId:'voice:raven',
      sourceVideoAssetId:'video:interview',
      sourceAudioAssetId:'audio:generated-original',
      replacementDialogueAssetId:'audio:raven-voice-lock',
      dialogueRegions:[
        {id:'dialogue:1',lineId:'line:1',startSeconds:0,endSeconds:6,evidenceIds:['transcript:1']},
        {id:'dialogue:2',lineId:'line:2',startSeconds:8,endSeconds:14,evidenceIds:['transcript:2']},
      ],
      preserveSourceAudioRegions:[
        {id:'laugh:1',kind:'nonverbal-vocalization',label:'natural laugh between answers',startSeconds:6.1,endSeconds:7,evidenceIds:['audio-review:1']},
        {id:'steps:1',kind:'foley',label:'walking footsteps',startSeconds:14.2,endSeconds:16,evidenceIds:['audio-review:2']},
        {id:'room:1',kind:'ambience',label:'continuous interview-room bed',startSeconds:16.1,endSeconds:20,evidenceIds:['audio-review:3']},
      ],
      evidenceIds:['voice-edit:approved'],
      authority:'DIRECTOR_VOICE_REPLACEMENT_EDIT',
    })).toEqual([]);
  });

  it('fails when a preserved original-audio region overlaps dialogue being replaced',()=>{
    const reasons=validateVoiceReplacementEditPlan({
      id:'voice-edit:bad',projectId:'p',characterId:'raven',voiceIdentityId:'voice:raven',
      sourceVideoAssetId:'v',sourceAudioAssetId:'a',replacementDialogueAssetId:'r',
      dialogueRegions:[{id:'d',lineId:'l',startSeconds:0,endSeconds:5,evidenceIds:['e']}],
      preserveSourceAudioRegions:[{id:'p',kind:'sfx',label:'sound',startSeconds:4,endSeconds:6,evidenceIds:['e']}],
      evidenceIds:['e'],authority:'DIRECTOR_VOICE_REPLACEMENT_EDIT',
    });
    expect(reasons).toContain('DIRECTOR_VOICE_REPLACEMENT_REGION_CONFLICT:p:d');
  });
});
