import type {
  WeeklySocialRuntimeRepository,
  WeeklySocialActionStateRow,
} from "./weekly-runtime-repository";

export type WeeklyActionExecutionState =
  | "completed"
  | "waiting"
  | "failed"
  | "ambiguous";

export interface WeeklyActionExecutionResult {
  state: WeeklyActionExecutionState;
  externalReceiptRefs?: readonly string[];
  error?: string;
}

export interface WeeklyActionExecutionHandler {
  supports(kind: WeeklySocialActionStateRow["action_kind"]): boolean;
  execute(
    row: WeeklySocialActionStateRow,
  ): Promise<WeeklyActionExecutionResult>;
}

export interface WeeklySchedulerRunResult {
  ownerUserId: string;
  observedAt: string;
  attempted: number;
  completed: number;
  waiting: number;
  failed: number;
  ambiguous: number;
  handlerMissing: number;
  actionResults: readonly Readonly<{
    packetId: string;
    actionId: string;
    actionKind: string;
    state: WeeklyActionExecutionState | "handler_missing";
    externalReceiptRefs: readonly string[];
    error?: string;
  }>[];
  policy: Readonly<{
    approvedDurableActionsOnly: true;
    ambiguousActionsNeverBlindlyRetried: true;
    missingHandlerFailsClosed: true;
    handlerMustReportAmbiguousSideEffects: true;
  }>;
}

export async function runWeeklySocialScheduler(input: {
  ownerUserId: string;
  observedAt?: string;
  repository: WeeklySocialRuntimeRepository;
  handlers: readonly WeeklyActionExecutionHandler[];
  limit?: number;
}): Promise<WeeklySchedulerRunResult> {
  const observedAt = input.observedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new Error("SOCIAL_WEEKLY_SCHEDULER_TIME_INVALID");
  }
  const limit = input.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("SOCIAL_WEEKLY_SCHEDULER_LIMIT_INVALID");
  }

  const due = await input.repository.listDueActions({
    ownerUserId: input.ownerUserId,
    observedAt,
    limit,
  });
  const results: WeeklySchedulerRunResult["actionResults"][number][] = [];

  for (const row of due) {
    // A previously started action may have caused an external side effect.
    // Only explicit reconciliation may release it for another dispatch.
    if (row.attempt_count > 0) {
      await input.repository.updateActionState({
        ownerUserId: input.ownerUserId,
        packetId: row.packet_id,
        actionId: row.action_id,
        status: "ambiguous",
        externalReceiptRefs: row.external_receipt_refs,
        lastError: "SOCIAL_WEEKLY_PREVIOUS_ATTEMPT_REQUIRES_RECONCILIATION",
      });
      results.push(Object.freeze({
        packetId: row.packet_id,
        actionId: row.action_id,
        actionKind: row.action_kind,
        state: "ambiguous" as const,
        externalReceiptRefs: Object.freeze([...row.external_receipt_refs]),
        error: "SOCIAL_WEEKLY_PREVIOUS_ATTEMPT_REQUIRES_RECONCILIATION",
      }));
      continue;
    }
    const handler = input.handlers.find((candidate) =>
      candidate.supports(row.action_kind),
    );
    if (!handler) {
      await input.repository.updateActionState({
        ownerUserId: input.ownerUserId,
        packetId: row.packet_id,
        actionId: row.action_id,
        status: "waiting",
        lastError: "SOCIAL_WEEKLY_HANDLER_NOT_CONFIGURED",
      });
      results.push(Object.freeze({
        packetId: row.packet_id,
        actionId: row.action_id,
        actionKind: row.action_kind,
        state: "handler_missing" as const,
        externalReceiptRefs: Object.freeze([] as string[]),
        error: "SOCIAL_WEEKLY_HANDLER_NOT_CONFIGURED",
      }));
      continue;
    }

    await input.repository.updateActionState({
      ownerUserId: input.ownerUserId,
      packetId: row.packet_id,
      actionId: row.action_id,
      status: "running",
    });

    let outcome: WeeklyActionExecutionResult;
    try {
      outcome = await handler.execute(row);
    } catch (error) {
      // Provider side effects may have happened before the handler threw.
      // Do not retry an unclassified failure without reconciliation.
      outcome = {
        state: "ambiguous",
        error: "SOCIAL_WEEKLY_HANDLER_OUTCOME_UNKNOWN:"
          + (error instanceof Error ? error.message : String(error)),
      };
    }

    const receiptRefs = Object.freeze([
      ...new Set(outcome.externalReceiptRefs ?? []),
    ]);
    await input.repository.updateActionState({
      ownerUserId: input.ownerUserId,
      packetId: row.packet_id,
      actionId: row.action_id,
      status: outcome.state,
      externalReceiptRefs: receiptRefs,
      lastError: outcome.error,
    });

    results.push(Object.freeze({
      packetId: row.packet_id,
      actionId: row.action_id,
      actionKind: row.action_kind,
      state: outcome.state,
      externalReceiptRefs: receiptRefs,
      error: outcome.error,
    }));
  }

  return Object.freeze({
    ownerUserId: input.ownerUserId,
    observedAt,
    attempted: results.length,
    completed: results.filter((result) => result.state === "completed").length,
    waiting: results.filter((result) => result.state === "waiting").length,
    failed: results.filter((result) => result.state === "failed").length,
    ambiguous: results.filter((result) => result.state === "ambiguous").length,
    handlerMissing: results.filter(
      (result) => result.state === "handler_missing",
    ).length,
    actionResults: Object.freeze(results),
    policy: Object.freeze({
      approvedDurableActionsOnly: true as const,
      ambiguousActionsNeverBlindlyRetried: true as const,
      missingHandlerFailsClosed: true as const,
      handlerMustReportAmbiguousSideEffects: true as const,
    }),
  });
}
