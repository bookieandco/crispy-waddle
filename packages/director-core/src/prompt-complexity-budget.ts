export interface ModelPromptComplexityProfile {
  id:string;
  providerId:string;
  modelId:string;
  modelVersion:string;
  hardMaxDurationSeconds?:number;
  recommendedMaximumPromptCharacters?:number;
  recommendedMaximumInstructionCount?:number;
  recommendedMaximumReferenceCount?:number;
  recommendedMaximumConcurrentCameraMoves?:number;
  measuredAt:string;
  evidenceIds:readonly string[];
  authority:'PROVIDER_PROMPT_COMPLEXITY_PROFILE';
}

export interface PromptComplexityMeasurement {
  projectId:string;
  takeId:string;
  promptCharacters:number;
  instructionCount:number;
  referenceCount:number;
  concurrentCameraMoveCount:number;
  targetDurationSeconds:number;
  evidenceIds:readonly string[];
}

export interface PromptComplexityDecision {
  admissible:boolean;
  warnings:readonly string[];
  errors:readonly string[];
  authority:'DIRECTOR_PROMPT_COMPLEXITY_QC';
}

export function evaluatePromptComplexity(
  profile:ModelPromptComplexityProfile,
  measurement:PromptComplexityMeasurement,
):PromptComplexityDecision{
  const errors:string[]=[];
  const warnings:string[]=[];

  if(
    !profile.id.trim()||
    !profile.providerId.trim()||
    !profile.modelId.trim()||
    !profile.modelVersion.trim()||
    !profile.measuredAt.trim()||
    !profile.evidenceIds.length
  ) errors.push('DIRECTOR_PROMPT_COMPLEXITY_PROFILE_PROVENANCE_REQUIRED');

  for(const [name,value] of [
    ['promptCharacters',measurement.promptCharacters],
    ['instructionCount',measurement.instructionCount],
    ['referenceCount',measurement.referenceCount],
    ['concurrentCameraMoveCount',measurement.concurrentCameraMoveCount],
  ] as const){
    if(!Number.isInteger(value)||value<0) errors.push(`DIRECTOR_PROMPT_COMPLEXITY_MEASUREMENT_INVALID:${name}`);
  }
  if(!Number.isFinite(measurement.targetDurationSeconds)||measurement.targetDurationSeconds<=0){
    errors.push('DIRECTOR_PROMPT_COMPLEXITY_DURATION_INVALID');
  }
  if(!measurement.evidenceIds.length) errors.push('DIRECTOR_PROMPT_COMPLEXITY_EVIDENCE_REQUIRED');

  if(
    profile.hardMaxDurationSeconds!==undefined&&
    measurement.targetDurationSeconds>profile.hardMaxDurationSeconds
  ) errors.push('DIRECTOR_PROMPT_COMPLEXITY_DURATION_EXCEEDS_MODEL_MAX');

  const checks:Array<[number,number|undefined,string]>= [
    [measurement.promptCharacters,profile.recommendedMaximumPromptCharacters,'PROMPT_CHARACTERS'],
    [measurement.instructionCount,profile.recommendedMaximumInstructionCount,'INSTRUCTION_COUNT'],
    [measurement.referenceCount,profile.recommendedMaximumReferenceCount,'REFERENCE_COUNT'],
    [measurement.concurrentCameraMoveCount,profile.recommendedMaximumConcurrentCameraMoves,'CAMERA_MOVE_COUNT'],
  ];
  for(const [value,maximum,label] of checks){
    if(maximum!==undefined&&value>maximum){
      warnings.push(`DIRECTOR_PROMPT_COMPLEXITY_ABOVE_MEASURED_ENVELOPE:${label}`);
    }
  }

  return Object.freeze({
    admissible:errors.length===0,
    warnings:Object.freeze([...new Set(warnings)]),
    errors:Object.freeze([...new Set(errors)]),
    authority:'DIRECTOR_PROMPT_COMPLEXITY_QC',
  });
}
