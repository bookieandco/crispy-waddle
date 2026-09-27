import { describe, expect, it } from 'vitest';
import {
  DIRECTOR_FEATURE_NLE_ROUND_TRIP_POLICY,
  evaluateDirectorTimelineRoundTrip,
  serializeDirectorTimelineToFcpxml,
  serializeDirectorTimelineToOtio,
} from './nle-roundtrip.js';
import type { EditableTimeline } from './timeline-model.js';

function timeline():EditableTimeline{
  return {
    version:1,
    projectId:'film:1',
    fps:24,
    width:1920,
    height:1080,
    durationSeconds:60,
    playheadSeconds:0,
    tracks:[
      {
        id:'v1',name:'Picture',kind:'video',index:0,
        clips:[{
          id:'clip:1',name:'Hero take',assetId:'asset:video:1',trackId:'v1',
          startSeconds:0,durationSeconds:10,sourceInSeconds:2,sourceOutSeconds:12,sourceDurationSeconds:30,
          transform:{positionX:0,positionY:0,scaleX:1,scaleY:1,rotationDegrees:0},
          takeGroupId:'takes:hero',takeId:'take:2',effects:[],generativeRegions:[],
        }],
      },
      {
        id:'a1',name:'Dialogue',kind:'audio',index:1,role:'dialogue',
        clips:[{
          id:'clip:2',name:'Dialogue stem',assetId:'asset:audio:1',trackId:'a1',
          startSeconds:0,durationSeconds:10,sourceInSeconds:0,sourceOutSeconds:10,
          audioRole:'dialogue',effects:[],generativeRegions:[],
        }],
      },
    ],
    transitions:[],
    markers:[],
    versions:[],
  };
}

describe('Director NLE interchange',()=>{
  it('exports provenance-bearing OTIO and FCPXML',()=>{
    const value=timeline();
    const otio=serializeDirectorTimelineToOtio(value,'timeline:v7');
    expect(otio).toContain('"OTIO_SCHEMA": "Timeline.1"');
    expect(otio).toContain('jhadina-asset://asset%3Avideo%3A1');
    expect(otio).toContain('"jhadinaTimelineVersionId": "timeline:v7"');

    const fcpxml=serializeDirectorTimelineToFcpxml(value,'timeline:v7');
    expect(fcpxml).toContain('<fcpxml version="1.11">');
    expect(fcpxml).toContain('com.jhadina.timelineVersionId');
    expect(fcpxml).toContain('data-jhadina-clip-id="clip:1"');
  });

  it('accepts a faithful external round trip',()=>{
    const original=timeline();
    const imported=structuredClone(original);
    expect(evaluateDirectorTimelineRoundTrip(original,imported,DIRECTOR_FEATURE_NLE_ROUND_TRIP_POLICY)).toMatchObject({
      admissible:true,
      reasons:[],
    });
  });

  it('fails closed when external editing loses source/take/transform lineage',()=>{
    const original=timeline();
    const imported=structuredClone(original);
    const clip=imported.tracks[0]!.clips[0]!;
    clip.sourceInSeconds=3;
    clip.takeId='take:9';
    clip.transform={...clip.transform!,scaleX:1.2};
    const decision=evaluateDirectorTimelineRoundTrip(original,imported,DIRECTOR_FEATURE_NLE_ROUND_TRIP_POLICY);
    expect(decision.admissible).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_NLE_SOURCE_IN_CHANGED:clip:1');
    expect(decision.reasons).toContain('DIRECTOR_NLE_TAKE_METADATA_CHANGED:clip:1');
    expect(decision.reasons).toContain('DIRECTOR_NLE_TRANSFORM_CHANGED:clip:1');
  });
});
