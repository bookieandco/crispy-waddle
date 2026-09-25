import {describe,expect,it,vi} from 'vitest';
import {buildPoseActionWindows,classifyPoseActionWindows,type PoseActionRecognitionPlan} from './pose-action-recognition';

const plan:PoseActionRecognitionPlan={
  id:'action-plan:1',
  projectId:'project-1',
  classifierId:'pose-lstm:v1',
  windowSize:3,
  stride:1,
  landmarkOrder:['leftWrist','rightWrist'],
  labels:['idle','wave','jump'],
  minimumConfidence:.7,
  evidenceIds:['training-set:actions-v1'],
  authority:'DIRECTOR_POSE_ACTION_RECOGNITION',
};
const annotations=[0,1,2,3].map(frame=>({
  frame,class:'character' as const,instanceId:'c1',confidence:.95,
  keypoints:[
    {name:'leftWrist',x:.2+frame*.01,y:.4,confidence:.95},
    {name:'rightWrist',x:.8,y:.4-frame*.01,confidence:.95},
  ],
}));
const track={trackId:'track-1',class:'character' as const,instanceId:'c1',frameStart:0,frameEnd:3,annotations,source:'hybrid' as const,confidence:.95,approved:true};

describe('pose action recognition',()=>{
  it('builds configurable rolling windows from approved pose evidence',()=>{
    const windows=buildPoseActionWindows(track,plan);
    expect(windows).toHaveLength(2);
    expect(windows[0]).toEqual(expect.objectContaining({frameStart:0,frameEnd:2}));
    expect(windows[0]!.vectors[0]).toHaveLength(4);
  });

  it('requires approved pose tracks before action classification',()=>{
    expect(()=>buildPoseActionWindows({...track,approved:false},plan)).toThrow('APPROVED_POSE_TRACK_REQUIRED');
  });

  it('keeps only admitted labels above the confidence threshold',async()=>{
    const classifier={classify:vi.fn(async()=>({label:'wave',confidence:.91,evidenceIds:['model:wave']}))};
    const predictions=await classifyPoseActionWindows(classifier,buildPoseActionWindows(track,plan),plan);
    expect(predictions).toHaveLength(2);
    expect(predictions[0]).toEqual(expect.objectContaining({label:'wave',confidence:.91,classifierId:'pose-lstm:v1'}));
  });
});
