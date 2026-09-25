import {describe,expect,it} from 'vitest';
import {humanResultToObservations} from './human-performance-observer';

const frame={assetId:'video-1',timestampSeconds:2,frameRef:'frame:2'};
const policy={minimumConfidence:.5,includeBody:true,includeHands:true,includeFaceOrientation:true,includeGestures:true,allowedBodyLandmarks:['head','leftWrist','rightWrist']};

describe('Human performance observer',()=>{
  it('maps body hand face-orientation and gesture evidence without demographic or identity fields',()=>{
    const observations=humanResultToObservations(frame,{
      body:[{id:1,score:.9,boxRaw:[.1,.1,.6,.8],keypoints:[
        {part:'leftWrist',positionRaw:[.2,.4,0],score:.95},
        {part:'leftHip',positionRaw:[.3,.7,0],score:.95},
      ]}],
      hand:[{id:2,score:.9,boxRaw:[.15,.3,.2,.2],label:'hand',keypoints:[[.2,.4,0],[.25,.45,0]]}],
      face:[{id:3,score:.9,rotation:{angle:{roll:0,yaw:.2,pitch:.1},gaze:{bearing:.1,strength:.8}},age:50,gender:'male',race:[{race:'other',score:.9}],embedding:[1,2,3]}],
      gesture:[{body:1,gesture:'leaning left'}],
    },policy);
    expect(observations.map(x=>x.kind)).toEqual(['human-body-pose','human-hand-pose','human-face-orientation','human-gesture']);
    expect(observations[0]!.payload).toEqual(expect.objectContaining({keypoints:[expect.objectContaining({name:'leftWrist'})]}));
    const serialized=JSON.stringify(observations);
    expect(serialized).not.toContain('"age"');
    expect(serialized).not.toContain('"gender"');
    expect(serialized).not.toContain('"race"');
    expect(serialized).not.toContain('"embedding"');
  });

  it('drops low-confidence and invalid geometry',()=>{
    const observations=humanResultToObservations(frame,{
      body:[{id:1,score:.2,boxRaw:[.1,.1,.6,.8],keypoints:[]}],
      hand:[{id:2,score:.9,boxRaw:[.9,.9,.4,.4],keypoints:[]}],
    },policy);
    expect(observations).toEqual([]);
  });
});
