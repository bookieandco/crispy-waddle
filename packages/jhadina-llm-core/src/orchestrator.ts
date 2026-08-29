import type { CapabilityRegistry } from "./capability-contract";
import type { ContextAssembler, Conversation, LlmTask, ModelRouter, PersonalityContext } from "./llm-contract";

export interface OrchestrationRequest {
  conversation: Conversation;
  instruction: string;
  task: LlmTask;
  personality?: PersonalityContext;
  capabilities?: { task: string; instruction: string };
}

export interface OrchestrationResponse {
  kind: "model" | "capability";
  content: unknown;
  capabilityId?: string;
}

export class JhadinaOrchestrator {
  constructor(
    private readonly models: ModelRouter,
    private readonly capabilities: CapabilityRegistry,
    private readonly context: ContextAssembler,
  ) {}

  async run(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    const capability = await this.capabilities.resolve(
      request.capabilities ?? { task: request.task, instruction: request.instruction },
    );

    if (capability) {
      const result = await capability.execute({
        conversationId: request.conversation.id,
        userInstruction: request.instruction,
      });
      return { kind: "capability", content: result, capabilityId: capability.id };
    }

    const messages = await this.context.assemble({
      conversation: request.conversation,
      task: request.task,
      personality: request.personality,
    });

    const response = await this.models.route({ task: request.task, messages });
    return { kind: "model", content: response };
  }
}
