import { createHash } from "node:crypto";
import type { EvolutionExecutionResult } from "./evolution-result";

export type EvolutionRunEventType =
  | "RUN_STARTED"
  | "RUN_DISPATCHED"
  | "RUN_VERIFIED"
  | "RUN_FAILED"
  | "RUN_BLOCKED"
  | "DRAFT_PR_CREATED";

export interface EvolutionRunLedgerEvent {
  sequence: number;
  eventId: string;
  runId: number;
  taskId: string;
  type: EvolutionRunEventType;
  occurredAt: string;
  payload: Record<string, unknown>;
  previousHash: string | null;
  hash: string;
}

export interface EvolutionRunLedger {
  append(event: Omit<EvolutionRunLedgerEvent, "sequence" | "eventId" | "hash">): Promise<EvolutionRunLedgerEvent>;
  list(runId: number): Promise<EvolutionRunLedgerEvent[]>;
}

export class InMemoryEvolutionRunLedger implements EvolutionRunLedger {
  private readonly events: EvolutionRunLedgerEvent[] = [];

  async append(input: Omit<EvolutionRunLedgerEvent, "sequence" | "eventId" | "hash">) {
    const previousHash = this.events.at(-1)?.hash ?? null;
    const sequence = this.events.length + 1;
    const eventId = `${input.runId}:${sequence}`;
    const hash = sha256(JSON.stringify({ ...input, sequence, eventId, previousHash }));
    const event = { ...input, sequence, eventId, previousHash, hash };
    this.events.push(event);
    return event;
  }

  async list(runId: number) {
    return this.events.filter((event) => event.runId === runId);
  }
}

export async function recordEvolutionExecutionResult(
  ledger: EvolutionRunLedger,
  result: EvolutionExecutionResult,
): Promise<EvolutionRunLedgerEvent[]> {
  const events: EvolutionRunLedgerEvent[] = [];
  const terminalType: EvolutionRunEventType =
    result.status === "VERIFIED" ? "RUN_VERIFIED" :
    result.status === "BLOCKED" ? "RUN_BLOCKED" : "RUN_FAILED";

  events.push(await ledger.append({
    runId: result.runId,
    taskId: result.taskId,
    type: terminalType,
    occurredAt: new Date().toISOString(),
    payload: {
      baseBranch: result.baseBranch,
      branch: result.branch,
      changedFiles: result.changedFiles,
      diffStat: result.diffStat,
      verification: result.verification,
      draftPr: result.draftPr,
    },
    previousHash: null,
  }));

  if (result.draftPr) {
    events.push(await ledger.append({
      runId: result.runId,
      taskId: result.taskId,
      type: "DRAFT_PR_CREATED",
      occurredAt: new Date().toISOString(),
      payload: { url: result.draftPr },
      previousHash: null,
    }));
  }

  return events;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
