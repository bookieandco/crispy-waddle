import { createDirectorActionHandlers, type DirectorTakeInput, type DirectorTakeResult, type GenerationAdapter } from '@jhadina/shotlist-core';
import type { ActionAdapter, ExecutionContext } from './action-executor';

export function createDirectorShotlistActionAdapters(generation: GenerationAdapter): ActionAdapter[] {
  const handlers = createDirectorActionHandlers(generation);
  return handlers.map((handler) => ({
    domain: handler.domain,
    capability: handler.capability,
    execute: async (input: DirectorTakeInput, _context: ExecutionContext): Promise<DirectorTakeResult> => handler.execute(input),
  }));
}
