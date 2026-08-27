import type { AgentDefinition, AgentTool } from "./types.js";

export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition>();

  register(agent: AgentDefinition): void {
    if (this.agents.has(agent.id)) throw new Error(`Agent already registered: ${agent.id}`);
    this.agents.set(agent.id, Object.freeze({ ...agent, allowedToolIds: [...agent.allowedToolIds] }));
  }

  get(agentId: string): AgentDefinition {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Unknown agent: ${agentId}`);
    return agent;
  }
}

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  register(tool: AgentTool): void {
    if (this.tools.has(tool.id)) throw new Error(`Tool already registered: ${tool.id}`);
    this.tools.set(tool.id, tool);
  }

  get(toolId: string): AgentTool {
    const tool = this.tools.get(toolId);
    if (!tool) throw new Error(`Unknown tool: ${toolId}`);
    return tool;
  }
}
