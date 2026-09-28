import {
  evaluateProductionCoherence,
  type ProductionCoherenceMetric,
  type ProductionCoherenceObservation,
} from './production-foundry.js';
import type { DirectorCoherenceLevel } from './production-quality-certification.js';

export interface DirectorHierarchicalProductionObservation extends ProductionCoherenceObservation {
  level: DirectorCoherenceLevel;
  scopeRef: string;
}

export interface DirectorHierarchicalCoherencePolicy {
  requiredLevels: readonly DirectorCoherenceLevel[];
  requiredMetricsByLevel: Readonly<Partial<Record<DirectorCoherenceLevel, readonly ProductionCoherenceMetric[]>>>;
  minimums: Readonly<Partial<Record<ProductionCoherenceMetric,number>>>;
  weights: Readonly<Partial<Record<ProductionCoherenceMetric,number>>>;
}

export interface DirectorHierarchicalCoherenceLevelDecision {
  level: DirectorCoherenceLevel;
  admissible: boolean;
  score: number;
  scopes: readonly string[];
  rerunScopes: readonly string[];
  reasons: readonly string[];
  evidenceIds: readonly string[];
}

export interface DirectorHierarchicalCoherenceDecision {
  admissible: boolean;
  levels: readonly DirectorHierarchicalCoherenceLevelDecision[];
  reasons: readonly string[];
  rerunScopes: readonly string[];
  authority: 'DIRECTOR_HIERARCHICAL_COHERENCE_QC';
}

export function evaluateDirectorHierarchicalCoherence(
  observations:readonly DirectorHierarchicalProductionObservation[],
  policy:DirectorHierarchicalCoherencePolicy,
):DirectorHierarchicalCoherenceDecision{
  const reasons:string[]=[];
  const rerun=new Set<string>();
  const levels:DirectorHierarchicalCoherenceLevelDecision[]=[];

  for(const level of policy.requiredLevels){
    const levelObservations=observations.filter((observation)=>observation.level===level);
    if(!levelObservations.length){
      reasons.push(`DIRECTOR_HIERARCHICAL_COHERENCE_LEVEL_MISSING:${level}`);
      levels.push(Object.freeze({
        level,
        admissible:false,
        score:0,
        scopes:Object.freeze([]),
        rerunScopes:Object.freeze([]),
        reasons:Object.freeze([`DIRECTOR_HIERARCHICAL_COHERENCE_LEVEL_MISSING:${level}`]),
        evidenceIds:Object.freeze([]),
      }));
      continue;
    }

    const requiredMetrics=policy.requiredMetricsByLevel[level]??[];
    if(!requiredMetrics.length){
      reasons.push(`DIRECTOR_HIERARCHICAL_COHERENCE_POLICY_MISSING:${level}`);
    }

    const decision=evaluateProductionCoherence(levelObservations,{
      requiredMetrics,
      minimums:policy.minimums,
      weights:policy.weights,
    });
    for(const scope of decision.rerunScopes) rerun.add(scope);
    const levelReasons=decision.reasons.map((reason)=>`${level}:${reason}`);
    reasons.push(...levelReasons);
    const scopes=[...new Set(levelObservations.map((observation)=>observation.scopeRef))];
    const evidenceIds=[...new Set(levelObservations.flatMap((observation)=>
      Object.values(observation.evidenceByMetric).flatMap((ids)=>ids??[])
    ))];
    levels.push(Object.freeze({
      level,
      admissible:decision.admissible,
      score:decision.score,
      scopes:Object.freeze(scopes),
      rerunScopes:Object.freeze([...decision.rerunScopes]),
      reasons:Object.freeze(levelReasons),
      evidenceIds:Object.freeze(evidenceIds),
    }));
  }

  return Object.freeze({
    admissible:reasons.length===0,
    levels:Object.freeze(levels),
    reasons:Object.freeze([...new Set(reasons)]),
    rerunScopes:Object.freeze([...rerun]),
    authority:'DIRECTOR_HIERARCHICAL_COHERENCE_QC',
  });
}

const SHOT_METRICS:readonly ProductionCoherenceMetric[]=Object.freeze([
  'shot-purpose','character-identity','voice-identity','wardrobe-continuity','product-fidelity',
  'spatial-continuity','performance-naturalness','lip-sync','audio-continuity',
  'temporal-continuity','visual-cleanliness','rights-coverage',
]);
const STORY_METRICS:readonly ProductionCoherenceMetric[]=Object.freeze([
  'story-causality','character-identity','voice-identity','wardrobe-continuity',
  'spatial-continuity','audio-continuity','temporal-continuity','rights-coverage',
]);

export const DIRECTOR_FEATURE_HIERARCHICAL_COHERENCE_POLICY:DirectorHierarchicalCoherencePolicy=Object.freeze({
  requiredLevels:Object.freeze(['shot','scene','sequence','act','final'] as DirectorCoherenceLevel[]),
  requiredMetricsByLevel:Object.freeze({
    shot:SHOT_METRICS,
    scene:STORY_METRICS,
    sequence:STORY_METRICS,
    act:STORY_METRICS,
    final:STORY_METRICS,
  }),
  minimums:Object.freeze({
    'story-causality':0.82,
    'shot-purpose':0.8,
    'character-identity':0.9,
    'voice-identity':0.88,
    'wardrobe-continuity':0.9,
    'product-fidelity':0.94,
    'spatial-continuity':0.84,
    'performance-naturalness':0.78,
    'lip-sync':0.84,
    'audio-continuity':0.84,
    'temporal-continuity':0.84,
    'visual-cleanliness':0.84,
    'rights-coverage':1,
  }),
  weights:Object.freeze({
    'story-causality':0.14,
    'shot-purpose':0.08,
    'character-identity':0.12,
    'voice-identity':0.08,
    'wardrobe-continuity':0.08,
    'product-fidelity':0.05,
    'spatial-continuity':0.08,
    'performance-naturalness':0.08,
    'lip-sync':0.06,
    'audio-continuity':0.06,
    'temporal-continuity':0.07,
    'visual-cleanliness':0.05,
    'rights-coverage':0.05,
  }),
});
