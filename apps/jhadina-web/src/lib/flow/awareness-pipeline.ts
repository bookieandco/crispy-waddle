import {
  createFlow,
  shouldFlush,
  type CurrentContext,
  type FlowEnvelope,
  type RetentionClass,
  type TrustState,
} from "./context-flow";

export type AwarenessLevel = "silent" | "fyi" | "heads_up" | "action_opportunity";

export interface AwarenessSignal {
  source: string;
  title: string;
  reason: string;
  level: AwarenessLevel;
  retention?: RetentionClass;
  expiresAt?: string;
  action?: { label: string; capability: string };
}

export interface AwarenessDecision extends AwarenessSignal {
  flowId: string;
  trust: TrustState;
  createdAt: string;
}

/**
 * Converts an observed signal into a short-lived awareness flow.
 * This layer deliberately does not execute actions or write durable memory.
 */
export function evaluateAwareness(
  signal: AwarenessSignal,
  context: CurrentContext,
): AwarenessDecision {
  const flow = createFlow("context", signal.source, {
    signal,
    context,
  }, {
    retention: signal.retention ?? "ephemeral",
    trust: "observed",
    expiresAt: signal.expiresAt,
    reason: signal.reason,
  });

  return {
    ...signal,
    flowId: flow.id,
    trust: flow.trust,
    createdAt: flow.createdAt,
  };
}

export function flushExpiredAwareness(
  flows: FlowEnvelope[],
  now = Date.now(),
): FlowEnvelope[] {
  return flows.filter((flow) => !shouldFlush(flow, now));
}

export function promoteAwarenessToAction(
  decision: AwarenessDecision,
): FlowEnvelope | null {
  if (decision.level !== "action_opportunity" || !decision.action) return null;

  return createFlow("trust", "awareness", decision, {
    retention: "session",
    trust: "proposed",
    expiresAt: decision.expiresAt,
    reason: decision.reason,
  });
}
