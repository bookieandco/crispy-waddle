import type { CurrentContext } from "./context-flow";
import type { AwarenessDecision } from "./awareness-pipeline";

export interface CommandContext {
  current: CurrentContext;
  awareness: AwarenessDecision[];
  source: "home" | "music" | "watch" | "social" | "director" | "browser" | "voice";
}

export interface CommandRequest {
  transcript: string;
  context: CommandContext;
  requestedAt: string;
}

export function createCommandRequest(
  transcript: string,
  context: CommandContext,
): CommandRequest {
  return {
    transcript: transcript.trim(),
    context,
    requestedAt: new Date().toISOString(),
  };
}

/**
 * The UI sends one command shape regardless of which surface opened Jhadina.
 * Execution belongs downstream to the policy/capability boundary.
 */
export function summarizeCommandContext(request: CommandRequest): string {
  const { current, awareness } = request.context;
  const active = awareness
    .filter((item) => item.level !== "silent")
    .slice(0, 5)
    .map((item) => `${item.level}: ${item.title} (${item.reason})`)
    .join("; ");

  return [
    current.app && `app=${current.app}`,
    current.activity && `activity=${current.activity}`,
    current.goal && `goal=${current.goal}`,
    current.location && `location=${current.location}`,
    current.recentCommand && `recent=${current.recentCommand}`,
    active && `awareness=${active}`,
  ].filter(Boolean).join(" | ");
}
