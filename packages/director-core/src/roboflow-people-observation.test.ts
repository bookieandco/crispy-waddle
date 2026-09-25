import {describe,expect,it} from 'vitest';
import {roboflowPeopleToVisualEvidence} from './roboflow-people-observation';

describe('Roboflow people observation',()=>{
  it('admits person aliases and rejects unrelated classes',()=>{
    const evidence=roboflowPeopleToVisualEvidence({
      id:'people:1',
      projectId:'project-1',
      assetId:'frame-1',
      observedAt:'2026-09-25T00:00:00Z',
      frame:30,
      fps:30,
      imageWidth:1000,
      imageHeight:500,
      result:{predictions:[
        {class:'person',confidence:.92,x:500,y:250,width:200,height:300},
        {class:'dog',confidence:.99,x:100,y:100,width:50,height:50},
      ]},
      evidenceRefs:['roboflow-response:sha256:abc'],
    });
    expect(evidence.provider).toContain('people-detection-o4rdr/12');
    expect(evidence.protectedRegions).toHaveLength(1);
    expect(evidence.protectedRegions[0]).toMatchObject({
      kind:'person',
      bounds:{x:.4,y:.2,width:.2,height:.6},
      confidence:.92,
    });
  });

  it('does not convert person detection into identity or tracking claims',()=>{
    const evidence=roboflowPeopleToVisualEvidence({
      id:'people:2',projectId:'p',assetId:'a',observedAt:'now',frame:0,fps:24,
      imageWidth:100,imageHeight:100,
      result:{predictions:[{class_name:'people',confidence:.8,x:50,y:50,width:20,height:40}]},
      evidenceRefs:['rf:1'],
    });
    expect(evidence.annotationKind).toBe('box');
    expect(evidence.limitations.join(' ')).toContain('does not establish identity');
    expect(evidence.protectedRegions[0]?.trackId).toBe('people-detection-o4rdr/12:person');
  });
});
