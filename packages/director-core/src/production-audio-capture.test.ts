import {describe,expect,it} from 'vitest';
import {
  FILMMAKING_101_AUDIO_CAPTURE_PROFILE,
  validateProductionAudioScenePlan,
} from './production-audio-capture';

describe('production audio capture',()=>{
  it('admits dedicated dialogue audio plus camera reference and room tone',()=>{
    expect(validateProductionAudioScenePlan({
      id:'audio:scene-1',
      projectId:'p',
      sceneId:'scene:1',
      dialogueExpected:true,
      microphonePlacements:[
        {
          id:'mic:boom',
          microphoneKind:'directional-boom',
          targetSubjectId:'character:a',
          distanceToTargetMeters:.7,
          hiddenFromPicture:true,
          purpose:'Primary dialogue capture close to the speaker.',
          evidenceIds:['sound-plan:1'],
        },
        {
          id:'mic:camera',
          microphoneKind:'camera-reference',
          hiddenFromPicture:true,
          purpose:'Reference/sync audio.',
          evidenceIds:['camera-audio:1'],
        },
      ],
      cameraReferenceAudio:true,
      syncReference:'sync:clap-1',
      roomTone:[
        {
          id:'room:1',
          sceneId:'scene:1',
          locationId:'location:kitchen',
          durationSeconds:45,
          observedNoiseSources:['air-conditioning','refrigerator'],
          assetId:'audio:room-tone-1',
          evidenceIds:['room-tone:take-1'],
        },
      ],
      evidenceIds:['sound-plan:1'],
      authority:'DIRECTOR_PRODUCTION_AUDIO_PLAN',
    },FILMMAKING_101_AUDIO_CAPTURE_PROFILE)).toEqual([]);
  });

  it('fails dialogue capture that relies only on distant camera reference audio',()=>{
    const reasons=validateProductionAudioScenePlan({
      id:'audio:scene-1',
      projectId:'p',
      sceneId:'scene:1',
      dialogueExpected:true,
      microphonePlacements:[
        {
          id:'mic:camera',
          microphoneKind:'camera-reference',
          hiddenFromPicture:true,
          purpose:'Reference only.',
          evidenceIds:['camera:1'],
        },
      ],
      cameraReferenceAudio:true,
      roomTone:[],
      evidenceIds:['sound-plan:1'],
      authority:'DIRECTOR_PRODUCTION_AUDIO_PLAN',
    },FILMMAKING_101_AUDIO_CAPTURE_PROFILE);
    expect(reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_PRODUCTION_AUDIO_DEDICATED_DIALOGUE_MIC_REQUIRED',
      'DIRECTOR_ROOM_TONE_REQUIRED_FOR_DIALOGUE_SCENE',
    ]));
  });
});
