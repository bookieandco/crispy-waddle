import {describe,expect,it} from 'vitest';
import {
  buildEnvironmentViewPackFromWorld,
  buildStoryboardReferenceBoardFromWorld,
  evaluateWorldPreviewCost,
  validateWorldCaptureSession,
  type WorldCaptureSession,
} from './world-reference-workflow';

const camera=(id:string,focalLengthMm:number)=>({
  id,
  position:{x:0,y:2,z:5},
  rotationDegrees:{x:0,y:180,z:0},
  focalLengthMm,
  evidenceIds:[`camera:${id}`],
});

const placement=(characterId:string,x:number)=>({
  characterId,
  position:{x,y:0,z:0},
  facingDegrees:0,
  evidenceIds:[`placement:${characterId}`],
});

const session:WorldCaptureSession={
  id:'world-session:bayou',
  projectId:'p',
  world:{
    id:'world:bayou',
    projectId:'p',
    environmentId:'bayou-shack',
    sourceKind:'text-derived',
    sourcePrompt:'A weathered bayou shack beside a dock in a swamp.',
    previewAssetId:'preview:bayou',
    canonicalStyleAssetIds:['style:gothic-swamp'],
    evidenceIds:['world-prompt:1','preview:accepted'],
    authority:'DIRECTOR_WORLD_BUILD_PLAN',
  },
  canonicalCaptureId:'capture:wide',
  captures:[
    {
      id:'capture:wide',
      projectId:'p',
      environmentId:'bayou-shack',
      worldPlanId:'world:bayou',
      viewLabel:'wide high angle',
      camera:camera('cam:wide',35),
      characters:[placement('cleo',0),placement('frogman',2)],
      referenceUse:'omni-reference',
      assetId:'image:wide',
      sha256:'sha-wide',
      evidenceIds:['capture:wide'],
    },
    {
      id:'capture:cleo-ots',
      projectId:'p',
      environmentId:'bayou-shack',
      worldPlanId:'world:bayou',
      viewLabel:'frogman POV toward Cleo',
      camera:camera('cam:cleo-ots',50),
      characters:[placement('cleo',0),placement('frogman',2)],
      referenceUse:'storyboard',
      assetId:'image:cleo-ots',
      sha256:'sha-cleo-ots',
      evidenceIds:['capture:cleo-ots'],
    },
    {
      id:'capture:first',
      projectId:'p',
      environmentId:'bayou-shack',
      worldPlanId:'world:bayou',
      viewLabel:'continuity first frame',
      camera:camera('cam:first',50),
      characters:[placement('cleo',0),placement('frogman',2)],
      referenceUse:'first-frame',
      continuityGroupId:'frog-dive',
      assetId:'image:first',
      sha256:'sha-first',
      evidenceIds:['capture:first'],
    },
    {
      id:'capture:last',
      projectId:'p',
      environmentId:'bayou-shack',
      worldPlanId:'world:bayou',
      viewLabel:'continuity last frame',
      camera:camera('cam:last',50),
      characters:[placement('cleo',.2),placement('frogman',1.5)],
      referenceUse:'last-frame',
      continuityGroupId:'frog-dive',
      assetId:'image:last',
      sha256:'sha-last',
      evidenceIds:['capture:last'],
    },
  ],
  evidenceIds:['world-session:approved'],
  authority:'DIRECTOR_WORLD_CAPTURE_SESSION',
};

function estimate(id:string,cost:number){
  return {
    id,
    projectId:'p',
    provider:'world-provider',
    modelId:'world-model',
    pricingUnit:'per-request' as const,
    pricingSourceRef:'pricing:world-current',
    quantity:1,
    unitPriceUsd:cost,
    estimatedCostUsd:cost,
    derivedAt:'2026-09-25T00:00:00Z',
    assumptions:['provider quote'],
  };
}

describe('world reference workflow',()=>{
  it('validates a world session and emits the existing environment view pack',()=>{
    expect(validateWorldCaptureSession(session)).toEqual([]);
    const pack=buildEnvironmentViewPackFromWorld(session);
    expect(pack.environmentId).toBe('bayou-shack');
    expect(pack.canonicalAssetId).toBe('image:wide');
    expect(pack.views).toHaveLength(4);
    expect(pack.views[1]?.evidenceIds).toEqual(expect.arrayContaining([
      'world-focal-length-mm:50',
      'world-reference-use:storyboard',
    ]));
  });

  it('allows loose reference captures to differ in placement while requiring endpoint character-set continuity',()=>{
    const loose:WorldCaptureSession={
      ...session,
      captures:session.captures.map(c=>c.id==='capture:cleo-ots'
        ? {...c,characters:[placement('cleo',4),placement('frogman',-2)]}
        : c),
    };
    expect(validateWorldCaptureSession(loose)).toEqual([]);

    const broken:WorldCaptureSession={
      ...session,
      captures:session.captures.map(c=>c.id==='capture:last'
        ? {...c,characters:[placement('cleo',.2)]}
        : c),
    };
    expect(validateWorldCaptureSession(broken))
      .toContain('DIRECTOR_WORLD_ENDPOINT_CHARACTER_SET_MISMATCH:frog-dive');
  });

  it('turns selected world captures into an existing storyboard reference board',()=>{
    const board=buildStoryboardReferenceBoardFromWorld({
      id:'board:bayou-dialogue',
      title:'Bayou dialogue coverage',
      session,
      captureIds:['capture:wide','capture:cleo-ots'],
      holdSeconds:2,
      evidenceIds:['storyboard:selection'],
    });
    expect(board.frames).toHaveLength(2);
    expect(board.frames[1]).toMatchObject({
      stillAssetId:'image:cleo-ots',
      metadata:{lens:'50mm',cameraAngle:'frogman POV toward Cleo'},
    });
  });

  it('requires an accepted preview and a real cost advantage before full world generation',()=>{
    expect(evaluateWorldPreviewCost({
      projectId:'p',
      previewEstimate:estimate('preview',.5),
      fullWorldEstimate:estimate('full',5),
      previewAccepted:true,
      evidenceIds:['preview:reviewed'],
    })).toEqual(expect.objectContaining({valid:true,projectedSavingsUsd:4.5}));

    expect(evaluateWorldPreviewCost({
      projectId:'p',
      previewEstimate:estimate('preview',.5),
      fullWorldEstimate:estimate('full',5),
      previewAccepted:false,
      evidenceIds:['preview:rejected'],
    }).reasons).toContain('DIRECTOR_WORLD_PREVIEW_NOT_ACCEPTED');
  });
});
