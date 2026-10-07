import { describe, expect, it } from "vitest";
import type {
  WeeklySocialRuntimeRepository,
  WeeklySocialActionStateRow,
} from "./weekly-runtime-repository";
import {
  runWeeklySocialScheduler,
  type WeeklyActionExecutionHandler,
} from "./weekly-runtime-worker";

function row(
  id: string,
  kind: WeeklySocialActionStateRow["action_kind"],
): WeeklySocialActionStateRow {
  return {
    user_id: "user:owner",
    packet_id: "weekly:1",
    action_id: id,
    campaign_id: "campaign:1",
    action_kind: kind,
    permit_id: "permit:" + id,
    action_fingerprint: "fingerprint:" + id,
    scheduled_at: "2026-10-07T17:00:00.000Z",
    status: "planned",
    attempt_count: 0,
    external_receipt_refs: [],
    last_error: null,
    updated_at: "2026-10-07T17:00:00.000Z",
  };
}

function repository(
  due: WeeklySocialActionStateRow[],
): {
  repo: WeeklySocialRuntimeRepository;
  updates: Array<Record<string, unknown>>;
} {
  const updates: Array<Record<string, unknown>> = [];
  const repo = {
    async listDueActions() {
      return due;
    },
    async updateActionState(input: Record<string, unknown>) {
      updates.push(input);
    },
    async saveDraftPacket() {},
    async registerApprovedPacket() {
      throw new Error("not used");
    },
    async saveReport() {},
    async upsertEngagementTarget() {},
    async listEngagementTargets() {
      return [];
    },
    async consume() {
      return true;
    },
  } as unknown as WeeklySocialRuntimeRepository;
  return { repo, updates };
}

describe("weekly Social scheduler core", () => {
  it("executes due approved-runtime actions through their canonical handler", async () => {
    const state = repository([row("organic:1", "organic_publication")]);
    const handlers: WeeklyActionExecutionHandler[] = [{
      supports: (kind) => kind === "organic_publication",
      async execute() {
        return {
          state: "completed",
          externalReceiptRefs: ["provider:post:1"],
        };
      },
    }];

    const result = await runWeeklySocialScheduler({
      ownerUserId: "user:owner",
      observedAt: "2026-10-07T18:00:00.000Z",
      repository: state.repo,
      handlers,
    });

    expect(result.completed).toBe(1);
    expect(result.attempted).toBe(1);
    expect(result.actionResults[0]?.externalReceiptRefs)
      .toEqual(["provider:post:1"]);
    expect(state.updates.map((update) => update.status))
      .toEqual(["running", "completed"]);
  });

  it("fails closed when a subsystem handler is not configured", async () => {
    const state = repository([row("paid:1", "paid_campaign")]);

    const result = await runWeeklySocialScheduler({
      ownerUserId: "user:owner",
      observedAt: "2026-10-07T18:00:00.000Z",
      repository: state.repo,
      handlers: [],
    });

    expect(result.handlerMissing).toBe(1);
    expect(result.failed).toBe(0);
    expect(state.updates).toEqual([
      expect.objectContaining({
        actionId: "paid:1",
        status: "waiting",
        lastError: "SOCIAL_WEEKLY_HANDLER_NOT_CONFIGURED",
      }),
    ]);
  });

  it("persists ambiguous provider state instead of treating it as retryable failure", async () => {
    const state = repository([row("organic:ambiguous", "organic_publication")]);
    const handlers: WeeklyActionExecutionHandler[] = [{
      supports: (kind) => kind === "organic_publication",
      async execute() {
        return {
          state: "ambiguous",
          externalReceiptRefs: ["provider-operation:unknown"],
          error: "Provider accepted the request but final delivery is unknown.",
        };
      },
    }];

    const result = await runWeeklySocialScheduler({
      ownerUserId: "user:owner",
      observedAt: "2026-10-07T18:00:00.000Z",
      repository: state.repo,
      handlers,
    });

    expect(result.ambiguous).toBe(1);
    expect(result.policy.ambiguousActionsNeverBlindlyRetried).toBe(true);
    expect(state.updates.at(-1)).toEqual(expect.objectContaining({
      actionId: "organic:ambiguous",
      status: "ambiguous",
    }));
  });

  it("treats an unclassified handler exception as failed, requiring an explicit retry decision", async () => {
    const state = repository([row("director:1", "director_production")]);
    const handlers: WeeklyActionExecutionHandler[] = [{
      supports: (kind) => kind === "director_production",
      async execute() {
        throw new Error("DIRECTOR_RUNTIME_UNAVAILABLE");
      },
    }];

    const result = await runWeeklySocialScheduler({
      ownerUserId: "user:owner",
      observedAt: "2026-10-07T18:00:00.000Z",
      repository: state.repo,
      handlers,
    });

    expect(result.failed).toBe(1);
    expect(state.updates.at(-1)).toEqual(expect.objectContaining({
      status: "failed",
      lastError: "DIRECTOR_RUNTIME_UNAVAILABLE",
    }));
  });
});
