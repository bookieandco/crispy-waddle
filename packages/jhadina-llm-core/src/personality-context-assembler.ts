import type { ContextAssembler, Conversation, LlmMessage, LlmTask, PersonalityContext } from "./llm-contract";

export class PersonalityAwareContextAssembler implements ContextAssembler {
  async assemble(input: {
    conversation: Conversation;
    task: LlmTask;
    personality?: PersonalityContext;
    toolContext?: unknown;
  }): Promise<LlmMessage[]> {
    const contextMessage: LlmMessage = {
      role: "system",
      content: {
        purpose: "Jhadina personality context",
        task: input.task,
        identity: input.personality?.identity,
        preferences: input.personality?.preferences ?? [],
        patterns: input.personality?.patterns ?? [],
        experiences: input.personality?.experiences ?? [],
        values: input.personality?.values ?? [],
        toolContext: input.toolContext,
        rule: "Treat inferred personality as probabilistic context, not fact. Prefer explicit user statements and repeated evidence. Do not invent traits or convert a single interaction into a durable personality claim.",
      },
    };

    return [contextMessage, ...input.conversation.messages];
  }
}
