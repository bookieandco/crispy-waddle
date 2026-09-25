export interface ProductionFeasibilityCheck {
  affordable:boolean;
  estimatedDurationDays:number;
  legalOrSafetyBlocked:boolean;
  advancesAtOthersExpense:boolean;
  notes:readonly string[];
  evidenceIds:readonly string[];
}

export interface NonfictionStoryCompass {
  id:string;
  projectId:string;
  problem:string;
  intention:string;
  obstacle:string;
  solution:string;
  timeConstraint?:string;
  logline:string;
  titleConcept?:string;
  thumbnailConcept?:string;
  openingHook:string;
  act1Impact:string;
  act2Influence:string;
  act3Transformation:string;
  identifiableCharacters:readonly string[];
  significantMomentOrEvent:string;
  authenticEmotion:string;
  specificDetails:readonly string[];
  referenceAssetIds:readonly string[];
  feasibility:ProductionFeasibilityCheck;
  evidenceIds:readonly string[];
  authority:'DIRECTOR_STORY_COMPASS';
}

export interface StoryCompassDecision {
  admissible:boolean;
  reasons:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_STORY_COMPASS_QC';
}

export function validateNonfictionStoryCompass(
  compass:NonfictionStoryCompass,
):StoryCompassDecision{
  const reasons:string[]=[];
  if(!compass.id.trim()||!compass.projectId.trim()) reasons.push('DIRECTOR_STORY_COMPASS_IDENTITY_REQUIRED');
  for(const [field,value] of Object.entries({
    problem:compass.problem,
    intention:compass.intention,
    obstacle:compass.obstacle,
    solution:compass.solution,
    logline:compass.logline,
    openingHook:compass.openingHook,
    act1Impact:compass.act1Impact,
    act2Influence:compass.act2Influence,
    act3Transformation:compass.act3Transformation,
    significantMomentOrEvent:compass.significantMomentOrEvent,
    authenticEmotion:compass.authenticEmotion,
  })){
    if(!value.trim()) reasons.push(`DIRECTOR_STORY_COMPASS_FIELD_REQUIRED:${field}`);
  }
  if(!compass.identifiableCharacters.length) reasons.push('DIRECTOR_STORY_COMPASS_CHARACTERS_REQUIRED');
  if(!compass.specificDetails.length) reasons.push('DIRECTOR_STORY_COMPASS_SPECIFICS_REQUIRED');
  if(!compass.referenceAssetIds.length) reasons.push('DIRECTOR_STORY_COMPASS_REFERENCES_REQUIRED');
  if(!compass.evidenceIds.length) reasons.push('DIRECTOR_STORY_COMPASS_EVIDENCE_REQUIRED');
  if(!Number.isFinite(compass.feasibility.estimatedDurationDays)||compass.feasibility.estimatedDurationDays<=0){
    reasons.push('DIRECTOR_STORY_COMPASS_DURATION_INVALID');
  }
  if(!compass.feasibility.evidenceIds.length) reasons.push('DIRECTOR_STORY_COMPASS_FEASIBILITY_EVIDENCE_REQUIRED');
  if(!compass.feasibility.affordable) reasons.push('DIRECTOR_STORY_COMPASS_BUDGET_NOT_FEASIBLE');
  if(compass.feasibility.legalOrSafetyBlocked) reasons.push('DIRECTOR_STORY_COMPASS_LEGAL_OR_SAFETY_BLOCK');
  if(compass.feasibility.advancesAtOthersExpense) reasons.push('DIRECTOR_STORY_COMPASS_HARM_BOUNDARY_BLOCK');
  return Object.freeze({
    admissible:reasons.length===0,
    reasons:Object.freeze([...new Set(reasons)]),
    evidenceIds:Object.freeze([...new Set([...compass.evidenceIds,...compass.feasibility.evidenceIds])]),
    authority:'DIRECTOR_STORY_COMPASS_QC',
  });
}
