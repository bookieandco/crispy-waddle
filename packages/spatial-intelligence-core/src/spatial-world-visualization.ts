import type { SpatialContextPackage } from './integration.js';

export interface SpatialWorldVisualizationSeed {
  id:string;
  subject:string|null;
  geographicScope:unknown;
  evidenceRefs:readonly string[];
  realityRefs:readonly string[];
  provenanceRefs:readonly string[];
  sourceHealth:readonly string[];
  uncertainty:readonly string[];
  limitations:readonly string[];
  syntheticOutputPolicy:'MUST_NOT_REENTER_SPATIAL_REALITY';
  authority:'INTELLIGENCE_ONLY';
}

export function createSpatialWorldVisualizationSeed(input:{
  id:string;
  context:SpatialContextPackage;
  requireAdmittedReality:boolean;
}):SpatialWorldVisualizationSeed{
  if(!input.id.trim()) throw new Error('SPATIAL_WORLD_SEED_ID_REQUIRED');
  if(!input.context.evidence.length) throw new Error('SPATIAL_WORLD_SEED_EVIDENCE_REQUIRED');
  if(input.requireAdmittedReality&&!input.context.reality.length){
    throw new Error('SPATIAL_WORLD_SEED_ADMITTED_REALITY_REQUIRED');
  }

  return Object.freeze({
    id:input.id,
    subject:input.context.subject,
    geographicScope:input.context.geographicScope,
    evidenceRefs:Object.freeze([...new Set(input.context.evidence.map(ref=>ref.id))].sort()),
    realityRefs:Object.freeze([...new Set(input.context.reality.map(ref=>ref.id))].sort()),
    provenanceRefs:Object.freeze([...new Set(input.context.provenance.map(ref=>ref.id))].sort()),
    sourceHealth:Object.freeze([...input.context.sourceHealth]),
    uncertainty:Object.freeze([...input.context.uncertainty]),
    limitations:Object.freeze([
      ...new Set([
        ...input.context.limitations,
        'Any generated 3D world is a synthetic visualization derived from spatial intelligence, not a new observation.',
        'Synthetic renders, reconstructed geometry, camera state, or generated objects must never be admitted back into Spatial Reality as source evidence.',
        'GEV remains intelligence-only; world generation cannot authorize spatial operations.',
      ]),
    ]),
    syntheticOutputPolicy:'MUST_NOT_REENTER_SPATIAL_REALITY',
    authority:'INTELLIGENCE_ONLY',
  });
}
