import type { GatewayCommandResult } from "./command-runtime";

export interface ConversationalObservation {
  kind: "observation";
  capability: string;
  contentRef?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export function observationFromCommandResult(result: GatewayCommandResult): ConversationalObservation | null {
  if (result.capability !== "perception.look_at_screen" || result.ok !== true) return null;

  const output = result.output as { observation?: { contentRef?: string; summary?: string; metadata?: Record<string, unknown> } } | undefined;
  return {
    kind: "observation",
    capability: result.capability,
    contentRef: output?.observation?.contentRef,
    summary: output?.observation?.summary,
    metadata: output?.observation?.metadata,
  };
}
