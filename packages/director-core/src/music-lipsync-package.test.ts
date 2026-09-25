import {describe,expect,it} from 'vitest';
import {
  SOURCE_SEEDANCE_MUSIC_LIP_SYNC_POLICY,
  validateMusicLipSyncSegment,
} from './music-lipsync-package';

describe('music lip sync package',()=>{
  it('admits an exact-duration vocal-stem segment transported in the provider-required media form',()=>{
    const decision=validateMusicLipSyncSegment({
      id:'lip:verse-1',
      projectId:'p',
      characterId:'raven',
      voiceIdentityId:'voice:raven',
      sourceSongAssetId:'song:master',
      vocalStemAssetId:'stem:vocal',
      transportAssetId:'transport:vocal-video',
      transportMedia:'video',
      sourceStartSeconds:32,
      sourceEndSeconds:37,
      targetVideoDurationSeconds:5,
      referenceAssetIds:['character:raven:dj-outfit'],
      vocalStemOnly:true,
      evidenceIds:['edit:verse-1'],
      authority:'DIRECTOR_MUSIC_LIP_SYNC_SEGMENT',
    },SOURCE_SEEDANCE_MUSIC_LIP_SYNC_POLICY);
    expect(decision.valid).toBe(true);
    expect(decision.segmentDurationSeconds).toBe(5);
  });

  it('blocks full-mix audio or duration mismatch instead of asking the model to invent the song timing',()=>{
    const decision=validateMusicLipSyncSegment({
      id:'lip:bad',
      projectId:'p',
      characterId:'raven',
      sourceSongAssetId:'song:master',
      vocalStemAssetId:'song:master',
      transportAssetId:'transport:audio',
      transportMedia:'audio',
      sourceStartSeconds:0,
      sourceEndSeconds:8,
      targetVideoDurationSeconds:6,
      referenceAssetIds:['character:raven'],
      vocalStemOnly:false,
      evidenceIds:['edit:bad'],
      authority:'DIRECTOR_MUSIC_LIP_SYNC_SEGMENT',
    },SOURCE_SEEDANCE_MUSIC_LIP_SYNC_POLICY);
    expect(decision.reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_MUSIC_LIP_SYNC_DURATION_MISMATCH',
      'DIRECTOR_MUSIC_LIP_SYNC_VOCAL_STEM_REQUIRED',
      'DIRECTOR_MUSIC_LIP_SYNC_TRANSPORT_MEDIA_MISMATCH',
    ]));
  });
});
