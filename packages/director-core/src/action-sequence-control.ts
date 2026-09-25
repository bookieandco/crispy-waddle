export interface ActionSequenceRiskPolicy {
  id:string;
  highRiskThreshold:number;
  severeRiskThreshold:number;
  weights:{
    subjectMotion:number;
    cameraMotion:number;
    effectsDensity:number;
    interactionComplexity:number;
  };
}

export interface ActionSequenceRiskInput {
  id:string;
  projectId:string;
  shotId:string;
  subjectMotion:number;
  cameraMotion:number;
  effectsDensity:number;
  interactionComplexity:number;
  identityCritical:boolean;
  evidenceIds:readonly string[];
}

export interface ActionSequenceRiskDecision {
  score:number;
  level:'low'|'elevated'|'high'|'severe';
  requiredQcMetrics:readonly ('identity-stability'|'body-structure'|'temporal-flicker'|'motion-plausibility'|'detail-retention')[];
  reasons:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_ACTION_SEQUENCE_RISK';
}

export interface ReferenceIterationQualityPolicy {
  id:string;
  maximumEditDepth:number;
  minimumIdentityScore:number;
  minimumDetailScore:number;
}

export interface ReferenceIterationQualityInput {
  id:string;
  projectId:string;
  assetId:string;
  parentAssetId?:string;
  editDepth:number;
  identityScore:number;
  detailScore:number;
  evidenceIds:readonly string[];
}

export interface ReferenceIterationQualityDecision {
  admissible:boolean;
  reasons:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_REFERENCE_ITERATION_QC';
}

export function evaluateActionSequenceRisk(
  input:ActionSequenceRiskInput,
  policy:ActionSequenceRiskPolicy,
):ActionSequenceRiskDecision{
  const reasons:string[]=[];
  if(!input.id.trim()||!input.projectId.trim()||!input.shotId.trim()) reasons.push('DIRECTOR_ACTION_RISK_IDENTITY_REQUIRED');
  if(!input.evidenceIds.length) reasons.push('DIRECTOR_ACTION_RISK_EVIDENCE_REQUIRED');
  for(const [name,value] of Object.entries({
    subjectMotion:input.subjectMotion,
    cameraMotion:input.cameraMotion,
    effectsDensity:input.effectsDensity,
    interactionComplexity:input.interactionComplexity,
  })){
    if(!Number.isFinite(value)||value<0||value>1) reasons.push(`DIRECTOR_ACTION_RISK_INPUT_INVALID:${name}`);
  }
  if(
    !Number.isFinite(policy.highRiskThreshold)||policy.highRiskThreshold<0||policy.highRiskThreshold>1||
    !Number.isFinite(policy.severeRiskThreshold)||policy.severeRiskThreshold<policy.highRiskThreshold||policy.severeRiskThreshold>1
  ) reasons.push('DIRECTOR_ACTION_RISK_POLICY_THRESHOLD_INVALID');

  const weightEntries=Object.entries(policy.weights);
  if(weightEntries.some(([,value])=>!Number.isFinite(value)||value<0)||weightEntries.every(([,value])=>value===0)){
    reasons.push('DIRECTOR_ACTION_RISK_POLICY_WEIGHT_INVALID');
  }

  if(reasons.length){
    return Object.freeze({
      score:0,
      level:'severe',
      requiredQcMetrics:Object.freeze(['identity-stability','body-structure','temporal-flicker','motion-plausibility','detail-retention'] as const),
      reasons:Object.freeze([...new Set(reasons)]),
      evidenceIds:Object.freeze([...input.evidenceIds]),
      authority:'DIRECTOR_ACTION_SEQUENCE_RISK',
    });
  }

  const weighted=
    input.subjectMotion*policy.weights.subjectMotion+
    input.cameraMotion*policy.weights.cameraMotion+
    input.effectsDensity*policy.weights.effectsDensity+
    input.interactionComplexity*policy.weights.interactionComplexity;
  const total=
    policy.weights.subjectMotion+
    policy.weights.cameraMotion+
    policy.weights.effectsDensity+
    policy.weights.interactionComplexity;
  const score=weighted/total;

  const level:ActionSequenceRiskDecision['level']=
    score>=policy.severeRiskThreshold?'severe':
    score>=policy.highRiskThreshold?'high':
    score>=policy.highRiskThreshold*.7?'elevated':'low';

  if(level==='high'||level==='severe') reasons.push('DIRECTOR_ACTION_DEFORMATION_RISK_HIGH');
  if(input.identityCritical&&(level==='elevated'||level==='high'||level==='severe')) {
    reasons.push('DIRECTOR_ACTION_IDENTITY_RISK_REQUIRES_STRICT_QC');
  }

  const metrics=new Set<ActionSequenceRiskDecision['requiredQcMetrics'][number]>([
    'motion-plausibility',
  ]);
  if(input.identityCritical) metrics.add('identity-stability');
  if(level!=='low'){
    metrics.add('body-structure');
    metrics.add('temporal-flicker');
  }
  if(level==='high'||level==='severe') metrics.add('detail-retention');

  return Object.freeze({
    score,
    level,
    requiredQcMetrics:Object.freeze([...metrics]),
    reasons:Object.freeze([...new Set(reasons)]),
    evidenceIds:Object.freeze([...input.evidenceIds]),
    authority:'DIRECTOR_ACTION_SEQUENCE_RISK',
  });
}

export function evaluateReferenceIterationQuality(
  input:ReferenceIterationQualityInput,
  policy:ReferenceIterationQualityPolicy,
):ReferenceIterationQualityDecision{
  const reasons:string[]=[];
  if(!input.id.trim()||!input.projectId.trim()||!input.assetId.trim()) reasons.push('DIRECTOR_REFERENCE_ITERATION_IDENTITY_REQUIRED');
  if(!Number.isInteger(input.editDepth)||input.editDepth<0) reasons.push('DIRECTOR_REFERENCE_ITERATION_DEPTH_INVALID');
  if(input.editDepth>0&&!input.parentAssetId?.trim()) reasons.push('DIRECTOR_REFERENCE_ITERATION_PARENT_REQUIRED');
  if(!Number.isInteger(policy.maximumEditDepth)||policy.maximumEditDepth<0) reasons.push('DIRECTOR_REFERENCE_ITERATION_POLICY_DEPTH_INVALID');
  for(const [name,value] of Object.entries({
    identityScore:input.identityScore,
    detailScore:input.detailScore,
    minimumIdentityScore:policy.minimumIdentityScore,
    minimumDetailScore:policy.minimumDetailScore,
  })){
    if(!Number.isFinite(value)||value<0||value>1) reasons.push(`DIRECTOR_REFERENCE_ITERATION_SCORE_INVALID:${name}`);
  }
  if(!input.evidenceIds.length) reasons.push('DIRECTOR_REFERENCE_ITERATION_EVIDENCE_REQUIRED');

  if(input.editDepth>policy.maximumEditDepth) reasons.push('DIRECTOR_REFERENCE_ITERATION_DEPTH_EXCEEDED');
  if(input.identityScore<policy.minimumIdentityScore) reasons.push('DIRECTOR_REFERENCE_ITERATION_IDENTITY_DRIFT');
  if(input.detailScore<policy.minimumDetailScore) reasons.push('DIRECTOR_REFERENCE_ITERATION_DETAIL_LOSS');

  return Object.freeze({
    admissible:reasons.length===0,
    reasons:Object.freeze([...new Set(reasons)]),
    evidenceIds:Object.freeze([...input.evidenceIds]),
    authority:'DIRECTOR_REFERENCE_ITERATION_QC',
  });
}
