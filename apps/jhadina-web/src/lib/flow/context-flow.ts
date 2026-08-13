export type FlowKind = "context" | "data" | "event" | "energy" | "trust";

export type RetentionClass = "ephemeral" | "session" | "short_term" | "long_term" | "audit";

export type TrustState =
  | "unknown"
  | "observed"
  | "proposed"
  | "approved"
  | "executing"
  | "verified";

export interface FlowEnvelope<T = unknown> {
  id: string;
  kind: FlowKind;
  source: string;
  createdAt: string;
  retention: RetentionClass;
  trust: TrustState;
  payload: T;
  expiresAt?: string;
  reason?: string;
}

export interface CurrentContext {
  location?: string;
  activity?: string;
  app?: string;
  goal?: string;
  recentCommand?: string;
  timestamp: string;
}

export function createFlow<T>(
  kind: FlowKind,
  source: string,
  payload: T,
  options: Pick<FlowEnvelope<T>, "retention" | "trust" | "expiresAt" | "reason">,
): FlowEnvelope<T> {
  return {
    id: crypto.randomUUID(),
    kind,
    source,
    createdAt: new Date().toISOString(),
    ...options,
    payload,
  };
}

/**
 * Retention is deliberately explicit. Ingestion does not imply memory.
 * Callers should promote data only when it has durable value or audit value.
 */
export function shouldFlush(flow: FlowEnvelope, now = Date.now()): boolean {
  if (flow.retention === "audit" || flow.retention === "long_term") return false;
  if (flow.expiresAt) return new Date(flow.expiresAt).getTime() <= now;
  return flow.retention === "ephemeral";
}

export function promoteFlow<T>(flow: FlowEnvelope<T>, retention: RetentionClass): FlowEnvelope<T> {
  return { ...flow, retention };
}
