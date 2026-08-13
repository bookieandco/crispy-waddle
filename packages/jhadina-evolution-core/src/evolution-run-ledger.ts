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

type LedgerEventInput = Omit<
  EvolutionRunLedgerEvent,
  "sequence" | "eventId" | "previousHash" | "hash"
>;

export interface EvolutionRunLedger {
  append(event: LedgerEventInput): Promise<EvolutionRunLedgerEvent>;
  list(runId: number): Promise<EvolutionRunLedgerEvent[]>;
}

export class InMemoryEvolutionRunLedger implements EvolutionRunLedger {
  private readonly events: EvolutionRunLedgerEvent[] = [];

  async append(input: LedgerEventInput) {
    const runEvents = this.events.filter((event) => event.runId === input.runId);
    const previousHash = runEvents.at(-1)?.hash ?? null;
    const sequence = runEvents.length + 1;
    const eventId = `${input.runId}:${sequence}`;
    const hash = sha256(JSON.stringify({ ...input, sequence, eventId, previousHash }));
    const event: EvolutionRunLedgerEvent = {
      ...input,
      sequence,
      eventId,
      previousHash,
      hash,
    };
    this.events.push(event);
    return event;
  }

  async list(runId: number) {
    return this.events.filter((event) => event.runId === runId);
  }
}

export function verifyEvolutionRunLedger(events: EvolutionRunLedgerEvent[]): boolean {
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const previous = events[index - 1];

    if (event.sequence !== index + 1) return false;
    if (event.eventId !== `${event.runId}:${event.sequence}`) return false;
    if ((previous?.hash ?? null) !== event.previousHash) return false;

    const expectedHash = sha256(
      JSON.stringify({
        runId: event.runId,
        taskId: event.taskId,
        type: event.type,
        occurredAt: event.occurredAt,
        payload: event.payload,
        sequence: event.sequence,
        eventId: event.eventId,
        previousHash: event.previousHash,
      }),
    );

    if (event.hash !== expectedHash) return false;
  }

  return true;
}

export async function recordEvolutionExecutionResult(
  ledger: EvolutionRunLedger,
  result: EvolutionExecutionResult,
): Promise<EvolutionRunLedgerEvent[]> {
  const occurredAt = new Date().toISOString();
  const events: EvolutionRunLedgerEvent[] = [];

  events.push(await ledger.append({
    runId: result.runId,
    taskId: result.taskId,
    type: "RUN_DISPATCHED",
    occurredAt,
    payload: {
      baseBranch: result.baseBranch,
      branch: result.branch,
    },
  }));

  const terminalType: EvolutionRunEventType =
    result.status === "VERIFIED"
      ? "RUN_VERIFIED"
      : result.status === "BLOCKED"
        ? "RUN_BLOCKED"
        : "RUN_FAILED";

  events.push(await ledger.append({
    runId: result.runId,
    taskId: result.taskId,
    type: terminalType,
    occurredAt: new Date().toISOString(),
    payload: {
      changedFiles: result.changedFiles,
      diffStat: result.diffStat,
      verification: result.verification,
      draftPr: result.draftPr,
    },
  }));

  if (result.draftPr) {
    events.push(await ledger.append({
      runId: result.runId,
      taskId: result.taskId,
      type: "DRAFT_PR_CREATED",
      occurredAt: new Date().toISOString(),
      payload: { url: result.draftPr },
    }));
  }

  return events;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
