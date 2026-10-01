import {describe,expect,it} from 'vitest';
import {buildMusicVisualProductionPlan,certifyMusicDirectorClosedLoop} from './music-visual-production';

const source={
  musicProjectId:'music:1',
  songId:'song:1',
  songTitle:'Playa 2',
  audioAssetId:'audio:master',
  audioDurationSeconds:180,
  vocalStemAssetId:'audio:vocal',
  timedLyrics:[
    {id:'l1',startMs:0,endMs:5000,text:'line one',confidence:0.99},
    {id:'l2',startMs:5000,endMs:10000,text:'line two',confidence:0.99},
  ],
  songSections:[
    {id:'hook',songId:'song:1',startMs:0,endMs:15000,label:'Hook',functions:['lyric','loop'] as const},
  ],
  styleReferenceAssetIds:['style:1','style:2'],
  artistReferenceAssetIds:['artist:1'],
  rightsEvidenceIds:['rights:1'],
  campaignEvidenceIds:['campaign:1'],
};

describe('Director music visual production',()=>{
  it('creates a full music-video plan plus derivative shorts',()=>{
    const plan=buildMusicVisualProductionPlan({
      id:'mv:1',directorProjectId:'director:1',deliverable:'music_video',source,
      concept:'cinematic neighborhood performance',lipSyncRequested:true,characterPerformanceRequested:true,createStyleFrames:true,
    });
    expect(plan.status).toBe('READY');
    expect(plan.stages).toContain('style_frames');
    expect(plan.stages).toContain('lip_sync');
    expect(plan.stages).toContain('derivative_shorts');
    expect(plan.publicationAuthority).toBe('NONE');
  });

  it('makes six short variants from verified song timing',()=>{
    const plan=buildMusicVisualProductionPlan({
      id:'shorts:1',directorProjectId:'director:1',deliverable:'teaser_pack',source,
      concept:'social teaser family',targetTeaserCount:6,targetAspectRatios:['9:16'],
    });
    expect(plan.status).toBe('READY');
    expect(plan.segments).toHaveLength(6);
    expect(plan.segments.every((item)=>item.role==='teaser'&&item.endSeconds<=15)).toBe(true);
  });

  it('will not invent lyrics for a lyric video',()=>{
    const plan=buildMusicVisualProductionPlan({
      id:'lyrics:1',directorProjectId:'director:1',deliverable:'lyric_video',
      source:{...source,timedLyrics:[]},concept:'kinetic lyric video',lyricOverlayRequested:true,
    });
    expect(plan.status).toBe('DATA_REQUIRED');
    expect(plan.blockers).toContain('DIRECTOR_MUSIC_VISUAL_TIMED_LYRICS_REQUIRED');
  });

  it('passes the music-to-Director closed-loop certification',()=>{
    expect(certifyMusicDirectorClosedLoop().passed).toBe(true);
  });
});
