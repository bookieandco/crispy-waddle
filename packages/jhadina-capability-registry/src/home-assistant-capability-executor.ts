import type { ActionRequest, ActionResult } from '@jhadina/core-spine';
import type { HomeAssistantServiceMapper, HomeAssistantServiceCall } from './home-assistant-service-mapper.js';

export interface HomeAssistantServiceTransport {
  call(service: HomeAssistantServiceCall): Promise<unknown>;
}

/** Executes only already-governed HA action requests. */
export class HomeAssistantCapabilityExecutor {
  constructor(
    private readonly mapper: HomeAssistantServiceMapper,
    private readonly transport: HomeAssistantServiceTransport,
  ) {}

  async execute(request: ActionRequest): Promise<ActionResult> {
    const started = new Date().toISOString();
    try {
      const service = this.mapper.map(request);
      if (!service) {
        return { id: `failed:${request.id}`, requestId: request.id, success: false, error: 'unsupported Home Assistant action', completedAt: started };
      }
      const output = await this.transport.call(service);
      return { id: `completed:${request.id}`, requestId: request.id, success: true, output, completedAt: new Date().toISOString() };
    } catch (error) {
      return { id: `failed:${request.id}`, requestId: request.id, success: false, error: error instanceof Error ? error.message : 'Home Assistant execution failed', completedAt: new Date().toISOString() };
    }
  }
}
