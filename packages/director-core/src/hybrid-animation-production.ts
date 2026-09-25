export type HybridShotRoute='direct-generation'|'previs-conditioned'|'performance-research';

export interface HybridShotRoutingInput {
  id:string;
  projectId:string;
  shotId:string;
  specificMovement:boolean;
  specificCamera:boolean;
  timingCritical:boolean;
  multiObjectInteraction:boolean;
  subtlePerformanceCritical:boolean;
  motionEasyToDescribe:boolean;
  greyboxPerformanceReadable:boolean;
  evidenceIds:readonly string[];
}

export interface HybridShotRoutingDecision {
  route:HybridShotRoute;
  reasons:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_HYBRID_SHOT_ROUTING';
}

export interface ReferenceTraitObservation {
  referenceAssetId:string;
  trait:string;
  value:string;
  sourceRole:'character-sheet'|'prop-sheet'|'location-sheet'|'camera-reference'|'motion-reference'|'style-reference'|'other';
  canonical:boolean;
  evidenceIds:readonly string[];
}

export interface ReferenceCoherenceDecision {
  coherent:boolean;
  conflicts:readonly {
    trait:string;
    canonicalValue:string;
    conflictingAssetIds:readonly string[];
    conflictingValues:readonly string[];
  }[];
  reasons:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_REFERENCE_COHERENCE';
}

export type ProductionVisualRuleKind='style'|'lighting'|'surface'|'physics'|'camera'|'reference'|'negative-constraint';

export interface ProductionVisualRule {
  id:string;
  kind:ProductionVisualRuleKind;
  rule:string;
  sourceExperimentIds:readonly string[];
  evidenceIds:readonly string[];
  locked:boolean;
}

export interface ProductionVisualRuleLedger {
  id:string;
  projectId:string;
  rules:readonly ProductionVisualRule[];
  authority:'DIRECTOR_PRODUCTION_VISUAL_RULES';
}

export function routeHybridShot(input:HybridShotRoutingInput):HybridShotRoutingDecision{
  const reasons:string[]=[];
  if(!input.id.trim()||!input.projectId.trim()||!input.shotId.trim()) reasons.push('DIRECTOR_HYBRID_ROUTE_IDENTITY_REQUIRED');
  if(!input.evidenceIds.length) reasons.push('DIRECTOR_HYBRID_ROUTE_EVIDENCE_REQUIRED');
  if(reasons.length){
    return Object.freeze({
      route:'performance-research',
      reasons:Object.freeze(reasons),
      evidenceIds:Object.freeze([...input.evidenceIds]),
      authority:'DIRECTOR_HYBRID_SHOT_ROUTING',
    });
  }

  if(input.subtlePerformanceCritical&&!input.greyboxPerformanceReadable){
    reasons.push('DIRECTOR_HYBRID_PERFORMANCE_GAP');
    if(input.specificMovement||input.specificCamera||input.timingCritical){
      reasons.push('DIRECTOR_HYBRID_PREVIS_ALONE_INSUFFICIENT');
    }
    return Object.freeze({
      route:'performance-research',
      reasons:Object.freeze(reasons),
      evidenceIds:Object.freeze([...input.evidenceIds]),
      authority:'DIRECTOR_HYBRID_SHOT_ROUTING',
    });
  }

  if(
    input.specificMovement||
    input.specificCamera||
    input.timingCritical||
    input.multiObjectInteraction||
    !input.motionEasyToDescribe
  ){
    reasons.push('DIRECTOR_HYBRID_PREVIS_CONTROL_REQUIRED');
    return Object.freeze({
      route:'previs-conditioned',
      reasons:Object.freeze(reasons),
      evidenceIds:Object.freeze([...input.evidenceIds]),
      authority:'DIRECTOR_HYBRID_SHOT_ROUTING',
    });
  }

  reasons.push('DIRECTOR_HYBRID_DIRECT_GENERATION_SUFFICIENT');
  return Object.freeze({
    route:'direct-generation',
    reasons:Object.freeze(reasons),
    evidenceIds:Object.freeze([...input.evidenceIds]),
    authority:'DIRECTOR_HYBRID_SHOT_ROUTING',
  });
}

export function evaluateReferenceCoherence(
  observations:readonly ReferenceTraitObservation[],
):ReferenceCoherenceDecision{
  const reasons:string[]=[];
  const evidenceIds=[...new Set(observations.flatMap(item=>item.evidenceIds))];
  if(!observations.length) reasons.push('DIRECTOR_REFERENCE_COHERENCE_EVIDENCE_REQUIRED');

  const byTrait=new Map<string,ReferenceTraitObservation[]>();
  for(const observation of observations){
    if(!observation.referenceAssetId.trim()||!observation.trait.trim()||!observation.value.trim()){
      reasons.push('DIRECTOR_REFERENCE_COHERENCE_OBSERVATION_INVALID');
      continue;
    }
    if(!observation.evidenceIds.length) reasons.push(`DIRECTOR_REFERENCE_COHERENCE_OBSERVATION_EVIDENCE_REQUIRED:${observation.referenceAssetId}`);
    const list=byTrait.get(observation.trait)??[];
    list.push(observation);
    byTrait.set(observation.trait,list);
  }

  const conflicts:ReferenceCoherenceDecision['conflicts'][number][]=[];
  for(const [trait,items] of byTrait){
    const canonical=items.filter(item=>item.canonical);
    const canonicalValues=[...new Set(canonical.map(item=>item.value))];
    if(canonicalValues.length>1){
      reasons.push(`DIRECTOR_REFERENCE_CANONICAL_CONFLICT:${trait}`);
      continue;
    }
    const canonicalValue=canonicalValues[0];
    if(!canonicalValue) continue;
    const mismatches=items.filter(item=>item.value!==canonicalValue);
    if(mismatches.length){
      conflicts.push(Object.freeze({
        trait,
        canonicalValue,
        conflictingAssetIds:Object.freeze([...new Set(mismatches.map(item=>item.referenceAssetId))]),
        conflictingValues:Object.freeze([...new Set(mismatches.map(item=>item.value))]),
      }));
      reasons.push(`DIRECTOR_REFERENCE_TRAIT_CONFLICT:${trait}`);
    }
  }

  return Object.freeze({
    coherent:reasons.length===0&&conflicts.length===0,
    conflicts:Object.freeze(conflicts),
    reasons:Object.freeze([...new Set(reasons)]),
    evidenceIds:Object.freeze(evidenceIds),
    authority:'DIRECTOR_REFERENCE_COHERENCE',
  });
}

export function validateProductionVisualRuleLedger(
  ledger:ProductionVisualRuleLedger,
):readonly string[]{
  const reasons:string[]=[];
  if(!ledger.id.trim()||!ledger.projectId.trim()) reasons.push('DIRECTOR_VISUAL_RULE_LEDGER_IDENTITY_REQUIRED');
  if(!ledger.rules.length) reasons.push('DIRECTOR_VISUAL_RULE_LEDGER_RULES_REQUIRED');
  const ids=new Set<string>();
  for(const rule of ledger.rules){
    if(!rule.id.trim()||ids.has(rule.id)) reasons.push(`DIRECTOR_VISUAL_RULE_ID_INVALID:${rule.id||'unknown'}`);
    ids.add(rule.id);
    if(!rule.rule.trim()) reasons.push(`DIRECTOR_VISUAL_RULE_TEXT_REQUIRED:${rule.id}`);
    if(!rule.sourceExperimentIds.length) reasons.push(`DIRECTOR_VISUAL_RULE_EXPERIMENT_REQUIRED:${rule.id}`);
    if(!rule.evidenceIds.length) reasons.push(`DIRECTOR_VISUAL_RULE_EVIDENCE_REQUIRED:${rule.id}`);
  }
  return Object.freeze([...new Set(reasons)]);
}

export function productionVisualRuleEvidence(ledger:ProductionVisualRuleLedger):readonly string[]{
  const reasons=validateProductionVisualRuleLedger(ledger);
  if(reasons.length) throw new Error(`DIRECTOR_VISUAL_RULE_LEDGER_INVALID: ${reasons.join(', ')}`);
  return Object.freeze([
    `visual-rule-ledger:${ledger.id}`,
    ...ledger.rules.map(rule=>`visual-rule:${rule.id}:${rule.kind}:${rule.locked?'locked':'advisory'}`),
    ...ledger.rules.flatMap(rule=>rule.evidenceIds),
  ]);
}
