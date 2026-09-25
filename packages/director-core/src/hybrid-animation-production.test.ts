import {describe,expect,it} from 'vitest';
import {
  evaluateReferenceCoherence,
  productionVisualRuleEvidence,
  routeHybridShot,
  validateProductionVisualRuleLedger,
  type ProductionVisualRuleLedger,
} from './hybrid-animation-production';

describe('hybrid animation production',()=>{
  it('routes exact camera movement and timing into previs instead of relying on text alone',()=>{
    expect(routeHybridShot({
      id:'route:taxi-gap',projectId:'p',shotId:'taxi-gap',
      specificMovement:true,specificCamera:true,timingCritical:true,multiObjectInteraction:true,
      subtlePerformanceCritical:false,motionEasyToDescribe:false,greyboxPerformanceReadable:true,
      evidenceIds:['board:orange-mark','animator:blocking-note'],
    })).toEqual(expect.objectContaining({
      route:'previs-conditioned',
      reasons:['DIRECTOR_HYBRID_PREVIS_CONTROL_REQUIRED'],
    }));
  });

  it('routes subtle acting into research when the greybox cannot carry performance detail',()=>{
    expect(routeHybridShot({
      id:'route:handle-gag',projectId:'p',shotId:'handle-gag',
      specificMovement:false,specificCamera:false,timingCritical:true,multiObjectInteraction:true,
      subtlePerformanceCritical:true,motionEasyToDescribe:false,greyboxPerformanceReadable:false,
      evidenceIds:['board:reaction-pause','test:greybox-expression-lost'],
    })).toEqual(expect.objectContaining({
      route:'performance-research',
      reasons:expect.arrayContaining([
        'DIRECTOR_HYBRID_PERFORMANCE_GAP',
        'DIRECTOR_HYBRID_PREVIS_ALONE_INSUFFICIENT',
      ]),
    }));
  });

  it('allows simple shots to stay direct-generation',()=>{
    expect(routeHybridShot({
      id:'route:simple',projectId:'p',shotId:'simple',
      specificMovement:false,specificCamera:false,timingCritical:false,multiObjectInteraction:false,
      subtlePerformanceCritical:false,motionEasyToDescribe:true,greyboxPerformanceReadable:true,
      evidenceIds:['board:simple-shot'],
    }).route).toBe('direct-generation');
  });

  it('detects a framing reference that silently drops a canonical character trait',()=>{
    const decision=evaluateReferenceCoherence([
      {referenceAssetId:'character-sheet',trait:'headphones',value:'present',sourceRole:'character-sheet',canonical:true,evidenceIds:['design-lock:1']},
      {referenceAssetId:'camera-screenshot',trait:'headphones',value:'absent',sourceRole:'camera-reference',canonical:false,evidenceIds:['take:camera-angle']},
      {referenceAssetId:'character-sheet',trait:'hoodie',value:'blue',sourceRole:'character-sheet',canonical:true,evidenceIds:['design-lock:1']},
      {referenceAssetId:'camera-screenshot',trait:'hoodie',value:'blue',sourceRole:'camera-reference',canonical:false,evidenceIds:['take:camera-angle']},
    ]);
    expect(decision.coherent).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_REFERENCE_TRAIT_CONFLICT:headphones');
    expect(decision.conflicts[0]).toEqual(expect.objectContaining({
      trait:'headphones',
      canonicalValue:'present',
      conflictingAssetIds:['camera-screenshot'],
    }));
  });

  it('turns successful pre-production experiments into durable visual rules',()=>{
    const ledger:ProductionVisualRuleLedger={
      id:'rules:passport-rush',
      projectId:'p',
      rules:[
        {id:'lighting:golden-hour',kind:'lighting',rule:'Use low warm late-afternoon light with long shadows.',sourceExperimentIds:['exp:midday-vs-evening'],evidenceIds:['test:evening-depth'],locked:true},
        {id:'surface:taxi-clean-3d',kind:'surface',rule:'Keep the recurring taxi clean 3D; reserve heavy watercolor texture for the surrounding world.',sourceExperimentIds:['exp:taxi-watercolor-load'],evidenceIds:['test:taxi-motion'],locked:true},
        {id:'reference:recurring-props',kind:'reference',rule:'Build dedicated prop sheets only for props that recur across shots.',sourceExperimentIds:['exp:prop-recurrence'],evidenceIds:['asset-plan:trucks'],locked:false},
      ],
      authority:'DIRECTOR_PRODUCTION_VISUAL_RULES',
    };
    expect(validateProductionVisualRuleLedger(ledger)).toEqual([]);
    expect(productionVisualRuleEvidence(ledger)).toEqual(expect.arrayContaining([
      'visual-rule:lighting:golden-hour:lighting:locked',
      'visual-rule:surface:taxi-clean-3d:surface:locked',
    ]));
  });
});
