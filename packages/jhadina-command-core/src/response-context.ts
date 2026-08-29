import type { CommandExecutionResult } from "./registry-command-gateway";

export type ResponseContextKind = "observation" | "action" | "control";

export interface JhadinaResponseContext {
  commandId: string;
  kind: ResponseContextKind;
  disposition: CommandExecutionResult["disposition"];
  capabilityResult?: unknown;
  rationale?: string;
  clarification?: string;
  authoritative: boolean;
}

/** Converts a command result into authoritative context for the conversational layer.
 * This layer never claims that an action succeeded unless the execution boundary returned a result.
 */
export function toResponseContext(result: CommandExecutionResult): JhadinaResponseContext {
  const kind: ResponseContextKind = result.disposition === "execute"
    ? "action"
    : result.disposition === "answer"
      ? "observation"
      : "control";

  return {
    commandId: result.commandId,
    kind,
    disposition: result.disposition,
    capabilityResult: result.result,
    rationale: result.rationale,
    clarification: result.clarification,
    authoritative: result.disposition === "execute" || result.disposition === "answer",
  };
}
