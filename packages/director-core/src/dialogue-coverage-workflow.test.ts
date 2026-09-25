import {describe,expect,it} from 'vitest';
import {
  evaluateCoverageHandoff,
  validateDialogueCoveragePlan,
  type CoverageHandoffPlan,
  type DialogueCoveragePlan,
} from './dialogue-coverage-workflow';

const coverage:DialogueCoveragePlan={
  id:'coverage:meeting',
  projectId:'p',
  sceneId:'scene:meeting',
  locationAssetId:'location:room',
  cameraDiagramAssetId:'diagram:meeting-cameras',
  characterReferenceAssetIds:['char:a','char:b','char:c'],
  axisRef:'axis:table-180-line',
  eyelines:[
    {id:'eye:a-to-b',characterId:'a',targetCharacterId:'b',screenDirection:'camera-right',heightNormalized:.43,evidenceIds:['diagram:a-b']},
    {id:'eye:b-to-a',characterId:'b',targetCharacterId:'a',screenDirection:'camera-left',heightNormalized:.45,evidenceIds:['diagram:b-a']},
  ],
  shots:[
    {id:'master',role:'master',subjectCharacterIds:['a','b','c'],locationAssetId:'location:room',backgroundAnchorIds:['door','window','table'],eyelineIds:['eye:a-to-b','eye:b-to-a'],cameraPlanRef:'camera:master',evidenceIds:['coverage:master']},
    {id:'a-mcu',role:'medium-close-up',subjectCharacterIds:['a'],locationAssetId:'location:room',backgroundAnchorIds:['window','table'],eyelineIds:['eye:a-to-b'],cameraPlanRef:'camera:a-mcu',evidenceIds:['coverage:a']},
    {id:'b-reverse',role:'reverse',subjectCharacterIds:['b'],locationAssetId:'location:room',backgroundAnchorIds:['door','table'],eyelineIds:['eye:b-to-a'],cameraPlanRef:'camera:b-reverse',evidenceIds:['coverage:b']},
  ],
  evidenceIds:['location:approved','diagram:approved'],
  authority:'DIRECTOR_DIALOGUE_COVERAGE',
};

function estimate(id:string,provider:string,modelId:string,cost:number){
  return {
    id,
    projectId:'p',
    provider,
    modelId,
    pricingUnit:'per-request' as const,
    pricingSourceRef:'pricing:2026-09-25',
    quantity:1,
    unitPriceUsd:cost,
    estimatedCostUsd:cost,
    derivedAt:'2026-09-25T00:00:00Z',
    assumptions:['scene estimate'],
  };
}

const handoff:CoverageHandoffPlan={
  id:'handoff:meeting',
  projectId:'p',
  sceneId:'scene:meeting',
  coveragePlanId:'coverage:meeting',
  establishmentModel:{
    providerId:'premium-provider',
    modelId:'camera-strong-model',
    costEstimate:estimate('cost:establish','premium-provider','camera-strong-model',6),
  },
  dialogueModel:{
    providerId:'value-provider',
    modelId:'lip-sync-model',
    costEstimate:estimate('cost:dialogue','value-provider','lip-sync-model',4),
  },
  allPremiumDialogueEstimate:estimate('cost:all-premium','premium-provider','camera-strong-model',18),
  selectedFrames:[
    {
      id:'frame:a-right',
      coverageShotId:'a-mcu',
      characterId:'a',
      sourceVideoAssetId:'coverage-video',
      sourceTimeSeconds:2.1,
      frameAssetId:'frame:a:2.1',
      frameSha256:'sha-a',
      eyelineId:'eye:a-to-b',
      backgroundAnchorIds:['window','table'],
      evidenceIds:['frame-qc:a'],
    },
    {
      id:'frame:b-left',
      coverageShotId:'b-reverse',
      characterId:'b',
      sourceVideoAssetId:'coverage-video',
      sourceTimeSeconds:3.8,
      frameAssetId:'frame:b:3.8',
      frameSha256:'sha-b',
      eyelineId:'eye:b-to-a',
      backgroundAnchorIds:['door','table'],
      evidenceIds:['frame-qc:b'],
    },
  ],
  dialogueAudioAssetIds:['audio:a-line','audio:b-line'],
  requireStartFrame:true,
  requireAudioReference:true,
  evidenceIds:['handoff:approved'],
  authority:'DIRECTOR_DIALOGUE_COVERAGE_HANDOFF',
};

describe('dialogue coverage workflow',()=>{
  it('requires a single master plus dialogue coverage with governed eyelines',()=>{
    expect(validateDialogueCoveragePlan(coverage)).toEqual([]);
    expect(validateDialogueCoveragePlan({
      ...coverage,
      shots:coverage.shots.filter((shot)=>shot.role!=='master'),
    })).toContain('DIRECTOR_COVERAGE_SINGLE_MASTER_REQUIRED');
  });

  it('validates selected coverage frames as a cheaper dialogue-model handoff',()=>{
    const result=evaluateCoverageHandoff(coverage,handoff);
    expect(result.valid).toBe(true);
    expect(result.projectedSavingsUsd).toBe(8);
    expect(result.projectedSavingsFraction).toBeCloseTo(8/18);
  });

  it('fails when an extracted dialogue frame loses approved background geometry',()=>{
    const broken:CoverageHandoffPlan={
      ...handoff,
      selectedFrames:[
        {...handoff.selectedFrames[0]!,backgroundAnchorIds:['wrong-wall']},
        handoff.selectedFrames[1]!,
      ],
    };
    expect(evaluateCoverageHandoff(coverage,broken).reasons)
      .toContain('DIRECTOR_COVERAGE_FRAME_BACKGROUND_MISMATCH:frame:a-right');
  });

  it('fails when the two-stage handoff is not actually cheaper',()=>{
    const expensive:CoverageHandoffPlan={
      ...handoff,
      dialogueModel:{
        ...handoff.dialogueModel,
        costEstimate:estimate('cost:dialogue-expensive','value-provider','lip-sync-model',20),
      },
    };
    expect(evaluateCoverageHandoff(coverage,expensive).reasons)
      .toContain('DIRECTOR_COVERAGE_HANDOFF_NO_COST_ADVANTAGE');
  });
});
