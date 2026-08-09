import type { ActionHandler } from './core-adapters';
import type { CapabilityRequest, CapabilityResult, DomainId } from './contracts';

export interface ExecutionContext {
  requestId: string;
  userId?: string;
  projectId?: string;
  domain: DomainId;
  capability: string;
}

export interface ActionAdapter<TInput = unknown, TOutput = unknown> {
  domain: DomainId;
  capability: string;
  execute(input: TInput, context: ExecutionContext): Promise<TOutput>;
}

/** Executes only explicitly registered capabilities. No arbitrary shell/code execution is exposed here. */
export class ActionExecutor implements ActionHandler {
  constructor(private readonly adapters: readonly ActionAdapter[]) {}

  supports(domain: DomainId, capability: string): boolean {
    return this.adapters.some((adapter) => adapter.domain === domain && adapter.capability === capability);
  }

  async execute<TInput, TOutput>(request: CapabilityRequest<TInput>): Promise<CapabilityResult<TOutput>> {
    const adapter = this.adapters.find((candidate) => candidate.domain === request.domain && candidate.capability === request.capability);
    if (!adapter) {
      return {
        requestId: request.id,
        ok: false,
        error: { code: 'ACTION_NOT_REGISTERED', message: `No action adapter registered for ${request.domain}:${request.capability}.` },
        completedAt: new Date().toISOString(),
      };
    }

    try {
      const output = await adapter.execute(request.input, {
        requestId: request.id,
        userId: request.userId,
        projectId: request.projectId,
        domain: request.domain,
        capability: request.capability,
      });
      return { requestId: request.id, ok: true, output: output as TOutput, completedAt: new Date().toISOString() };
    } catch (error) {
      return {
        requestId: request.id,
        ok: false,
        error: {
          code: 'ACTION_EXECUTION_FAILED',
          message: error instanceof Error ? error.message : 'Action execution failed.',
        },
        completedAt: new Date().toISOString(),
      };
    }
  }
}
