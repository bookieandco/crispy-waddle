export interface SceneGenerationAttemptBudget {
  id:string;
  projectId:string;
  sceneId:string;
  recommendedMinimumAttempts?:number;
  recommendedMaximumAttempts?:number;
  hardMaximumAttempts?:number;
  stopWhenAccepted:boolean;
  evidenceIds:readonly string[];
  authority:'DIRECTOR_SCENE_ATTEMPT_BUDGET';
}

export interface SceneGenerationAttemptDecision {
  allowed:boolean;
  warnings:readonly string[];
  reasons:readonly string[];
  authority:'DIRECTOR_SCENE_ATTEMPT_BUDGET_QC';
}

export function evaluateSceneGenerationAttempt(
  budget:SceneGenerationAttemptBudget,
  attemptNumber:number,
):SceneGenerationAttemptDecision{
  const reasons:string[]=[];
  const warnings:string[]=[];
  if(!budget.id.trim()||!budget.projectId.trim()||!budget.sceneId.trim()){
    reasons.push('DIRECTOR_SCENE_ATTEMPT_BUDGET_IDENTITY_REQUIRED');
  }
  if(!budget.evidenceIds.length) reasons.push('DIRECTOR_SCENE_ATTEMPT_BUDGET_EVIDENCE_REQUIRED');
  if(!Number.isInteger(attemptNumber)||attemptNumber<1){
    reasons.push('DIRECTOR_SCENE_ATTEMPT_NUMBER_INVALID');
  }
  for(const [name,value] of [
    ['recommendedMinimumAttempts',budget.recommendedMinimumAttempts],
    ['recommendedMaximumAttempts',budget.recommendedMaximumAttempts],
    ['hardMaximumAttempts',budget.hardMaximumAttempts],
  ] as const){
    if(value!==undefined&&(!Number.isInteger(value)||value<1)){
      reasons.push(`DIRECTOR_SCENE_ATTEMPT_BUDGET_VALUE_INVALID:${name}`);
    }
  }
  if(
    budget.recommendedMinimumAttempts!==undefined&&
    budget.recommendedMaximumAttempts!==undefined&&
    budget.recommendedMinimumAttempts>budget.recommendedMaximumAttempts
  ) reasons.push('DIRECTOR_SCENE_ATTEMPT_RECOMMENDED_RANGE_INVALID');
  if(
    budget.recommendedMaximumAttempts!==undefined&&
    budget.hardMaximumAttempts!==undefined&&
    budget.recommendedMaximumAttempts>budget.hardMaximumAttempts
  ) reasons.push('DIRECTOR_SCENE_ATTEMPT_RECOMMENDATION_EXCEEDS_HARD_MAX');

  if(
    budget.recommendedMaximumAttempts!==undefined&&
    attemptNumber>budget.recommendedMaximumAttempts
  ) warnings.push('DIRECTOR_SCENE_ATTEMPT_ABOVE_RECOMMENDED_RANGE');

  if(
    budget.hardMaximumAttempts!==undefined&&
    attemptNumber>budget.hardMaximumAttempts
  ) reasons.push('DIRECTOR_SCENE_ATTEMPT_HARD_MAX_EXCEEDED');

  return Object.freeze({
    allowed:reasons.length===0,
    warnings:Object.freeze([...new Set(warnings)]),
    reasons:Object.freeze([...new Set(reasons)]),
    authority:'DIRECTOR_SCENE_ATTEMPT_BUDGET_QC',
  });
}
