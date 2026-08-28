import { createHash } from "node:crypto";
import type { AgentEvent, AgentEventType } from "./types.js";

export interface AgentEventLog {
  append(event: Omit<AgentEvent, "sequence" | "previousHash" | "hash">): AgentEvent;
  list(workflowRunId?: string): readonly AgentEvent[];
  verify(): boolean;
}

export class InMemoryAgentEventLog implements AgentEventLog {
  private readonly events: AgentEvent[] = [];

  append(input: Omit<AgentEvent, "sequence" | "previousHash" | "hash">): AgentEvent {
    const previousHash = this.events.at(-1)?.hash ?? null;
    const sequence = this.events.length + 1;
    const hash = createHash("sha256")
      .update(JSON.stringify({ ...input, sequence, previousHash }))
      .digest("hex");
    const event: AgentEvent = Object.freeze({ ...input, sequence, previousHash, hash });
    this.events.push(event);
    return event;
  }

  list(workflowRunId?: string): readonly AgentEvent[] {
    return workflowRunId ? this.events.filter((event) => event.workflowRunId === workflowRunId) : [...this.events];
  }

  verify(): boolean {
    let previousHash: string | null = null;
    for (let index = 0; index < this.events.length; index += 1) {
      const event = this.events[index];
      if (event.sequence !== index + 1 || event.previousHash !== previousHash) return false;
      const expected = createHash("sha256")
        .update(JSON.stringify({
          id: event.id,
          type: event.type,
          workflowRunId: event.workflowRunId,
          occurredAt: event.occurredAt,
          payload: event.payload,
          sequence: event.sequence,
          previousHash: event.previousHash,
        }))
        .digest("hex");
      if (event.hash !== expected) return false;
      previousHash = event.hash;
    }
    return true;
  }
}

export function eventId(runId: string, sequenceHint: number, type: AgentEventType): string {
  return `${runId}:${sequenceHint}:${type}`;
}
