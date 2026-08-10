import type { ActionAdapter } from './contracts.js';
import { buildAssemblyBrief, buildEditDecision, type FavoriteTake } from '@jhadina/director-core';

export type AssemblyAdapter = {
  assemble(input: { projectId: string; favorites: FavoriteTake[]; instruction: string }): Promise<{ editDecisionId: string; timelineUri?: string; sourceTakeIds: string[] }>;
  edit(input: { projectId: string; sceneId: string; sourceTakeId: string; operation: 'trim' | 'extend' | 'replace' | 'remove' | 'insert' | 'reframe' | 'retime' | 'fill'; instruction: string; startSeconds?: number; endSeconds?: number }): Promise<{ editDecisionId: string; timelineUri?: string; sourceTakeId: string }>;
};

export function createDirectorAssemblyActionAdapters(adapter: AssemblyAdapter): ActionAdapter[] {
  return [
    { domain: 'directoros', capability: 'edit.assembleFavorites', async execute(input: any) {
      const decision = buildEditDecision({ projectId: input.projectId, sceneId: input.sceneId ?? 'assembly', sourceTakeIds: input.favorites.map((x: FavoriteTake) => x.takeId), instruction: input.instruction, preserveContinuity: true, generativeEdits: [] });
      const assembled = await adapter.assemble({ projectId: input.projectId, favorites: input.favorites, instruction: buildAssemblyBrief(input.favorites, input.instruction).instruction });
      return { ...assembled, editDecisionId: decision.id };
    } },
    { domain: 'directoros', capability: 'edit.generative', async execute(input: any) {
      const decision = buildEditDecision({ projectId: input.projectId, sceneId: input.sceneId, sourceTakeIds: [input.sourceTakeId], instruction: input.instruction, preserveContinuity: true, generativeEdits: [{ id: crypto.randomUUID(), sourceTakeId: input.sourceTakeId, operation: input.operation, instruction: input.instruction, startSeconds: input.startSeconds, endSeconds: input.endSeconds }] });
      const edited = await adapter.edit(input);
      return { ...edited, editDecisionId: decision.id };
    } },
  ];
}
