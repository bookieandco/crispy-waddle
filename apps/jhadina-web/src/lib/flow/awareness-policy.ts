import type { CurrentContext, FlowEnvelope } from "./context-flow";

export type AwarenessLevel = "silent" | "fyi" | "heads_up" | "action_opportunity";

export interface AwarenessCandidate {
  id: string;
  title: string;
  message: string;
  level: AwarenessLevel;
  reason: string;
  expiresAt?: string;
  requiresApproval?: boolean;
  source: string;
}

export interface AwarenessPreferences {
  enabled: boolean;
  quietHours?: { start: string; end: string };
  minimumLevel: AwarenessLevel;
}

const levelRank: Record<AwarenessLevel, number> = {
  silent: 0,
  fyi: 1,
  heads_up: 2,
  action_opportunity: 3,
};

/**
 * Proactive awareness is advisory. This policy decides whether to surface
 * something; it never authorizes the underlying action.
 */
export function shouldSurface(
  candidate: AwarenessCandidate,
  preferences: AwarenessPreferences,
  context: CurrentContext,
): boolean {
  if (!preferences.enabled) return false;
  if (levelRank[candidate.level] < levelRank[preferences.minimumLevel]) return false;
  if (!candidate.reason.trim() || !candidate.message.trim()) return false;
  if (candidate.expiresAt && new Date(candidate.expiresAt).getTime() <= Date.now()) return false;

  // Avoid interruptions when there is no useful relationship to current context.
  // Explicitly sourced FYI items may still be shown by the UI's non-interruptive feed.
  if (candidate.level === "heads_up" || candidate.level === "action_opportunity") {
    return Boolean(context.activity || context.goal || context.app || context.recentCommand);
  }

  return true;
}

export function asFlow(candidate: AwarenessCandidate): FlowEnvelope<AwarenessCandidate> {
  return {
    id: candidate.id,
    kind: "event",
    source: candidate.source,
    createdAt: new Date().toISOString(),
    retention: "ephemeral",
    trust: "proposed",
    expiresAt: candidate.expiresAt,
    reason: candidate.reason,
    payload: candidate,
  };
}
