import {describe,expect,it} from 'vitest';
import {evaluateRehearsalTake,rehearsalGraduationReceipt,type RehearsalPlan,type RehearsalTake} from './rehearsal-loop.js';

const plan:RehearsalPlan={
  id:'reh:1',projectId:'film:1',sceneId:'scene:1',mode:'blocking',
  characterIds:['a','b'],
  cues:[
    {id:'c1',characterId:'a',beatRef:'beat:1',action:'cross to table',startSeconds:0,endSeconds:2},
    {id:'c2',characterId:'b',beatRef:'beat:2',lineRef:'line:2',startSeconds:2,endSeconds:4},
  ],
  referenceAssetIds:['char:a','char:b'],wardrobePlanRefs:[],cameraPlanRefs:[],
  maxTakes:3,escalationOrder:['blocking','performance','full-dress'],evidenceIds:['story:1'],
  authority:'DIRECTOR_REHEARSAL_PLAN',
};

describe('Director rehearsal loop',()=>{
  it('turns blocking and performance problems into actionable Director notes before final generation',()=>{
    const decision=evaluateRehearsalTake(plan,{
      takeNumber:1,mode:'blocking',
      observations:[{id:'o1',planId:'reh:1',takeNumber:1,characterId:'a',cueId:'c1',issue:'collision',severity:'fix',message:'Move A half a step camera-left before crossing.',score:.6,evidenceIds:['frame:1']}],
    });
    expect(decision.disposition).toBe('retry');
    expect(decision.notes[0]?.instruction).toContain('camera-left');
  });

  it('approves a clean rehearsal for graduation to expensive generation',()=>{
    expect(evaluateRehearsalTake(plan,{takeNumber:2,mode:'blocking',observations:[]}).disposition).toBe('approve');
  });

  it('requires an approved take before producing a rehearsal graduation receipt',()=>{
    const take:RehearsalTake={id:'take:1',planId:'reh:1',takeNumber:2,mode:'blocking',observations:[],directorNotes:[],status:'approved',evidenceIds:['preview:1']};
    expect(rehearsalGraduationReceipt(plan,take)).toContain('director-rehearsal:reh:1:2:blocking');
  });
});
