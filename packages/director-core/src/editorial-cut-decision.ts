export type EditorialCutCriterion =
  | 'emotion'
  | 'story'
  | 'rhythm'
  | 'eye-trace'
  | 'screen-plane'
  | 'spatial-continuity';

export type EditorialCriterionDisposition =
  | 'supports'
  | 'neutral'
  | 'conflicts'
  | 'intentional-disruption';

export interface EditorialCutCriterionAssessment {
  criterion:EditorialCutCriterion;
  disposition:EditorialCriterionDisposition;
  rationale:string;
  evidenceIds:readonly string[];
}

export interface EditorialCutDecision {
  id:string;
  projectId:string;
  timelineVersionId:string;
  beforeClipId:string;
  afterClipId:string;
  positiveReasonToCut:string;
  assessments:readonly EditorialCutCriterionAssessment[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_EDITORIAL_CUT_DECISION';
}

export interface EditorialCutDecisionResult {
  admissible:boolean;
  reviewRequired:boolean;
  reasons:readonly string[];
  authority:'DIRECTOR_EDITORIAL_CUT_QC';
}

export const EDITORIAL_RULE_OF_SIX_ORDER:readonly EditorialCutCriterion[]=Object.freeze([
  'emotion',
  'story',
  'rhythm',
  'eye-trace',
  'screen-plane',
  'spatial-continuity',
]);

export function evaluateEditorialCutDecision(
  decision:EditorialCutDecision,
):EditorialCutDecisionResult{
  const reasons:string[]=[];
  let reviewRequired=false;
  if(
    !decision.id.trim()||
    !decision.projectId.trim()||
    !decision.timelineVersionId.trim()||
    !decision.beforeClipId.trim()||
    !decision.afterClipId.trim()
  ) reasons.push('DIRECTOR_EDITORIAL_CUT_IDENTITY_REQUIRED');
  if(!decision.positiveReasonToCut.trim()) reasons.push('DIRECTOR_EDITORIAL_CUT_POSITIVE_REASON_REQUIRED');
  if(!decision.evidenceIds.length) reasons.push('DIRECTOR_EDITORIAL_CUT_EVIDENCE_REQUIRED');

  const byCriterion=new Map<EditorialCutCriterion,EditorialCutCriterionAssessment>();
  for(const assessment of decision.assessments){
    if(byCriterion.has(assessment.criterion)){
      reasons.push(`DIRECTOR_EDITORIAL_CUT_CRITERION_DUPLICATE:${assessment.criterion}`);
    }
    byCriterion.set(assessment.criterion,assessment);
    if(!assessment.rationale.trim()||!assessment.evidenceIds.length){
      reasons.push(`DIRECTOR_EDITORIAL_CUT_ASSESSMENT_INVALID:${assessment.criterion}`);
    }
    if(
      assessment.disposition==='intentional-disruption'&&
      !assessment.rationale.toLowerCase().includes('intent')
    ){
      reviewRequired=true;
    }
  }

  for(const criterion of EDITORIAL_RULE_OF_SIX_ORDER){
    if(!byCriterion.has(criterion)) reasons.push(`DIRECTOR_EDITORIAL_CUT_CRITERION_REQUIRED:${criterion}`);
  }

  for(const criterion of ['emotion','story','rhythm'] as const){
    const assessment=byCriterion.get(criterion);
    if(assessment?.disposition==='conflicts'){
      reasons.push(`DIRECTOR_EDITORIAL_CUT_PRIMARY_CONFLICT:${criterion}`);
    }
  }

  for(const criterion of ['eye-trace','screen-plane','spatial-continuity'] as const){
    const assessment=byCriterion.get(criterion);
    if(assessment?.disposition==='conflicts'){
      reviewRequired=true;
    }
  }

  return Object.freeze({
    admissible:reasons.length===0,
    reviewRequired,
    reasons:Object.freeze([...new Set(reasons)]),
    authority:'DIRECTOR_EDITORIAL_CUT_QC',
  });
}
