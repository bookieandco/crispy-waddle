import type { ActionAdapter, ExecutionContext } from './action-executor';
import type { CreatorProject, InMemoryCreatorProjectStore, SceneTake } from './creator-workstation';

export interface DirectorEngine {
  generateTake(input: {
    project: CreatorProject;
    sceneId: string;
    instruction?: string;
    priorTakeId?: string;
  }): Promise<{ takeId: string; assetIds: string[]; recipe: Record<string, unknown> }>;
}

/** Bridges DirectorOS/shotlist implementations into the common Creator project graph. */
export function createDirectorOSAdapter(store: InMemoryCreatorProjectStore, engine: DirectorEngine): ActionAdapter[] {
  return [
    {
      domain: 'directoros',
      capability: 'take.generate',
      async execute(input: { projectId: string; sceneId: string; instruction?: string }, context: ExecutionContext) {
        const project = store.get(input.projectId);
        if (!project) throw new Error(`Project not found: ${input.projectId}`);
        const result = await engine.generateTake({ project, sceneId: input.sceneId, instruction: input.instruction });
        return recordTake(project, input.sceneId, result, undefined);
      },
    },
    {
      domain: 'directoros',
      capability: 'take.regenerate',
      async execute(input: { projectId: string; sceneId: string; priorTakeId: string; instruction?: string }, context: ExecutionContext) {
        const project = store.get(input.projectId);
        if (!project) throw new Error(`Project not found: ${input.projectId}`);
        const result = await engine.generateTake({ project, sceneId: input.sceneId, instruction: input.instruction, priorTakeId: input.priorTakeId });
        return recordTake(project, input.sceneId, result, input.priorTakeId);
      },
    },
  ];
}

function recordTake(
  project: CreatorProject,
  sceneId: string,
  result: { takeId: string; assetIds: string[]; recipe: Record<string, unknown> },
  priorTakeId?: string,
): SceneTake {
  const scene = project.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) throw new Error(`Scene not found: ${sceneId}`);
  const take: SceneTake = {
    id: result.takeId,
    sceneId,
    takeNumber: scene.takeIds.length + 1,
    status: 'candidate',
    continuity: { priorTakeId },
    recipe: result.recipe,
    assetIds: result.assetIds,
  };
  scene.takeIds.push(take.id);
  return take;
}
