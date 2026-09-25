import { describe, expect, it } from 'vitest';
import {
  buildCurrentFrameGenerationManifest,
  planCurrentFrameExtraction,
} from './playhead-generation-continuation';
import type { EditableTimeline } from './timeline-model';

function timeline():EditableTimeline{
  return {
    version:1,
    projectId:'project-1',
    fps:30,
    width:1920,
    height:1080,
    durationSeconds:20,
    playheadSeconds:5,
    tracks:[
      {
        id:'video-main',
        name:'Main',
        kind:'video',
        index:0,
        clips:[{
          id:'clip-main',
          assetId:'video:main',
          trackId:'video-main',
          startSeconds:0,
          durationSeconds:10,
          sourceInSeconds:2,
          sourceOutSeconds:12,
          sourceDurationSeconds:30,
          speed:1,
          effects:[],
          generativeRegions:[],
        }],
      },
      {
        id:'overlay',
        name:'Overlay',
        kind:'overlay',
        index:1,
        clips:[{
          id:'clip-overlay',
          assetId:'video:overlay',
          trackId:'overlay',
          startSeconds:4,
          durationSeconds:4,
          sourceInSeconds:10,
          sourceOutSeconds:18,
          sourceDurationSeconds:30,
          speed:2,
          effects:[],
          generativeRegions:[],
        }],
      },
    ],
    transitions:[],
    markers:[],
    versions:[],
  };
}

describe('playhead generation continuation',()=> {
  it('uses the top visible active clip and computes exact source time through speed',()=> {
    const plan=planCurrentFrameExtraction({
      id:'frame-plan-1',
      timeline:timeline(),
      timelineVersionId:'timeline:v5',
      evidenceIds:['playhead:user-selected'],
    });

    expect(plan.sourceClipId).toBe('clip-overlay');
    expect(plan.sourceAssetId).toBe('video:overlay');
    expect(plan.timelineFrameIndex).toBe(150);
    expect(plan.sourceTimeSeconds).toBe(12);
    expect(plan.outputFrameAssetId).toBe('video:overlay:frame:12.000000');
  });

  it('lets an explicitly selected active clip override visual stacking order',()=> {
    const plan=planCurrentFrameExtraction({
      id:'frame-plan-2',
      timeline:timeline(),
      timelineVersionId:'timeline:v5',
      selectedClipId:'clip-main',
      evidenceIds:['selection:clip-main'],
    });
    expect(plan.sourceAssetId).toBe('video:main');
    expect(plan.sourceTimeSeconds).toBe(7);
  });

  it('computes reverse-playback source time correctly',()=> {
    const t=timeline();
    t.tracks[1]!.clips[0]={...t.tracks[1]!.clips[0]!,reverse:true};
    const plan=planCurrentFrameExtraction({
      id:'frame-plan-reverse',
      timeline:t,
      timelineVersionId:'timeline:v5',
      evidenceIds:['reverse:test'],
    });
    expect(plan.sourceTimeSeconds).toBe(16);
  });

  it('builds a first-frame plus source-video reference manifest after frame extraction',()=> {
    const extraction=planCurrentFrameExtraction({
      id:'frame-plan-3',
      timeline:timeline(),
      timelineVersionId:'timeline:v5',
      evidenceIds:['playhead:user-selected'],
    });
    const manifest=buildCurrentFrameGenerationManifest({
      id:'manifest:continuation',
      shotId:'shot:next',
      extraction,
      frame:{
        planId:extraction.id,
        assetId:extraction.outputFrameAssetId,
        sha256:'frame-sha',
        width:1920,
        height:1080,
        evidenceIds:['ffmpeg:frame-extract'],
      },
    });

    expect(manifest.references.map(ref=>[ref.role,ref.assetId])).toEqual([
      ['first-frame','video:overlay:frame:12.000000'],
      ['source-video','video:overlay'],
    ]);
    expect(manifest.references[0]?.required).toBe(true);
    expect(manifest.authority).toBe('DIRECTOR_REFERENCE_MANIFEST');
  });

  it('fails closed if there is no active visual clip under the playhead',()=> {
    const t=timeline();
    t.playheadSeconds=19;
    expect(()=>planCurrentFrameExtraction({
      id:'frame-plan-empty',
      timeline:t,
      timelineVersionId:'timeline:v5',
      evidenceIds:['playhead:empty'],
    })).toThrow('DIRECTOR_CURRENT_FRAME_VISUAL_CLIP_REQUIRED');
  });
});
