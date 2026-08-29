import type { SharkObservation } from '../observations/SharkObservation';
import type { SharkEntity, SharkEntityGraph, SharkRelation } from './SharkEntityGraph';

export interface GraphMutation {
  readonly entities: readonly SharkEntity[];
  readonly relations: readonly SharkRelation[];
}

/**
 * Deterministic projection boundary: observations become entities/relations.
 * This does not infer guilt, intent, or a trade recommendation.
 */
export function projectObservation(observation: SharkObservation): GraphMutation {
  const subject: SharkEntity = {
    id: observation.subjectId,
    type: observation.subjectType === 'token' ? 'token' :
      observation.subjectType === 'pool' ? 'pool' :
      observation.subjectType === 'wallet' ? 'wallet' :
      observation.subjectType === 'creator' ? 'creator' :
      observation.subjectType === 'mining' ? 'mining_operation' : 'exchange',
    chain: observation.chain,
    attributes: observation.value,
  };

  return { entities: [subject], relations: [] };
}

export function applyGraphMutation(graph: SharkEntityGraph, mutation: GraphMutation): SharkEntityGraph {
  const entityMap = new Map(graph.entities.map((entity) => [entity.id, entity]));
  for (const entity of mutation.entities) entityMap.set(entity.id, entity);

  const relationMap = new Map(graph.relations.map((relation) => [relation.id, relation]));
  for (const relation of mutation.relations) relationMap.set(relation.id, relation);

  return {
    entities: [...entityMap.values()],
    relations: [...relationMap.values()],
  };
}
