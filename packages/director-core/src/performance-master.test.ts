import {describe,expect,it} from 'vitest';
import {performanceMasterEvidence,validatePerformanceRetargetPlan,type PerformanceMaster,type PerformanceRetargetPlan} from './performance-master';

const master:PerformanceMaster={
  id:'perf:1',projectId:'p',sourceAssetId:'video:1',kind:'video',fps:24,durationSeconds:8,
  channels:['body','hands','face','speech-timing'],evidenceIds:['take:approved'],approved:true,
  authority:'DIRECTOR_PERFORMANCE_MASTER',
};
const plan:PerformanceRetargetPlan={
  id:'retarget:1',projectId:'p',sourcePerformanceMasterId:'perf:1',targetCharacterAssetId:'char:2',
  mode:'performer-replacement',
  preservation:{motion:'source',timing:'source',camera:'source',lighting:'source',environment:'source',voice:'source',wardrobe:'target'},
  evidenceIds:['retarget:intent'],authority:'DIRECTOR_PERFORMANCE_RETARGET_PLAN',
};

describe('performance master',()=>{
  it('keeps acting as a reusable approved asset independent from character identity',()=>{
    expect(validatePerformanceRetargetPlan(master,plan)).toEqual([]);
    expect(performanceMasterEvidence(master,plan)).toContain('performance-retarget:retarget:1:performer-replacement');
  });
  it('fails if a retarget request silently regenerates the source motion',()=>{
    expect(validatePerformanceRetargetPlan(master,{...plan,preservation:{...plan.preservation,motion:'regenerate'}}))
      .toContain('DIRECTOR_PERFORMANCE_RETARGET_SOURCE_MOTION_REQUIRED');
  });
  it('requires source camera continuity for exact performer replacement',()=>{
    expect(validatePerformanceRetargetPlan(master,{...plan,preservation:{...plan.preservation,camera:'regenerate'}}))
      .toContain('DIRECTOR_PERFORMANCE_REPLACEMENT_SOURCE_CAMERA_REQUIRED');
  });
});
