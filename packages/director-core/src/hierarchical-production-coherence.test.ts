import { describe, expect, it } from 'vitest';
import {
  DIRECTOR_FEATURE_HIERARCHICAL_COHERENCE_POLICY,
  evaluateDirectorHierarchicalCoherence,
  type DirectorHierarchicalProductionObservation,
} from './hierarchical-production-coherence.js';
import type { DirectorCoherenceLevel } from './production-quality-certification.js';
import type { ProductionCoherenceMetric } from './production-foundry.js';

const metrics:readonly ProductionCoherenceMetric[]=[
  'story-causality','shot-purpose','character-identity','voice-identity','wardrobe-continuity','product-fidelity',
  'spatial-continuity','performance-naturalness','lip-sync','audio-continuity','temporal-continuity',
  'visual-cleanliness','rights-coverage',
];

function observation(level:DirectorCoherenceLevel,scopeRef:string,score=.98):DirectorHierarchicalProductionObservation{
  return {
    id:`ob:${level}:${scopeRef}`,
    projectId:'film:1',
    segmentRef:scopeRef,
    scopeRef,
    level,
    startSeconds:0,
    endSeconds:10,
    metrics:Object.fromEntries(metrics.map((metric)=>[metric,metric==='rights-coverage'?1:score])),
    evidenceByMetric:Object.fromEntries(metrics.map((metric)=>[metric,[`evidence:${level}:${metric}`]])),
  };
}

describe('hierarchical production coherence',()=>{
  it('requires every feature-film hierarchy level',()=>{
    const decision=evaluateDirectorHierarchicalCoherence([
      observation('shot','shot:1'),
      observation('scene','scene:1'),
      observation('sequence','sequence:1'),
      observation('act','act:1'),
    ],DIRECTOR_FEATURE_HIERARCHICAL_COHERENCE_POLICY);
    expect(decision.admissible).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_HIERARCHICAL_COHERENCE_LEVEL_MISSING:final');
  });

  it('localizes a failing scene without invalidating evidence from other scopes',()=>{
    const decision=evaluateDirectorHierarchicalCoherence([
      observation('shot','shot:1'),
      observation('scene','scene:1',.6),
      observation('sequence','sequence:1'),
      observation('act','act:1'),
      observation('final','film:1'),
    ],DIRECTOR_FEATURE_HIERARCHICAL_COHERENCE_POLICY);
    expect(decision.admissible).toBe(false);
    expect(decision.rerunScopes).toContain('scene:1');
    expect(decision.rerunScopes).not.toContain('shot:1');
  });

  it('passes when shot through final evidence all clear policy',()=>{
    const decision=evaluateDirectorHierarchicalCoherence([
      observation('shot','shot:1'),
      observation('scene','scene:1'),
      observation('sequence','sequence:1'),
      observation('act','act:1'),
      observation('final','film:1'),
    ],DIRECTOR_FEATURE_HIERARCHICAL_COHERENCE_POLICY);
    expect(decision.admissible).toBe(true);
    expect(decision.levels).toHaveLength(5);
  });
});
