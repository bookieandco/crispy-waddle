import type { CommandContext, CommandRequest } from "./jhadina-command-context";

export type InteractionMode = "open" | "listen" | "type";
export type InteractionState = "idle" | "listening" | "thinking" | "acting" | "approval" | "done" | "error";

export interface JhadinaInteraction {
  id: string;
  mode: InteractionMode;
  state: InteractionState;
  context: CommandContext;
  request?: CommandRequest;
  response?: string;
  createdAt: string;
}

export function createInteraction(
  mode: InteractionMode,
  context: CommandContext,
): JhadinaInteraction {
  return {
    id: crypto.randomUUID(),
    mode,
    state: mode === "listen" ? "listening" : "idle",
    context,
    createdAt: new Date().toISOString(),
  };
}

export function attachCommand(
  interaction: JhadinaInteraction,
  request: CommandRequest,
): JhadinaInteraction {
  return { ...interaction, request, state: "thinking" };
}

export function withResponse(
  interaction: JhadinaInteraction,
  response: string,
  state: InteractionState = "done",
): JhadinaInteraction {
  return { ...interaction, response, state };
}
