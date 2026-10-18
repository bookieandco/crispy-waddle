import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { JhadinaWorkSession, WorkSessionTask } from "@jhadina/core-spine";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(), session: vi.fn(), tasks: vi.fn(), database: vi.fn(),
}));
vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify: mocks.verify }),
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => mocks.database(),
}));
vi.mock("@/lib/work-session/supabase-work-session-repository", () => ({
  SupabaseWorkSessionRepository: class { get = mocks.session; },
}));
vi.mock("@/lib/work-session/supabase-work-session-task-repository", () => ({
  SupabaseWorkSessionTaskRepository: class { list = mocks.tasks; },
}));
import { GET } from "./route";

const id = "ws-1";
const params = { params: Promise.resolve({ id }) };
const session = {
  id, ownerUserId: "owner-a", goal: "Repair the mobile boutique",
  status: "active", activeSubsystems: ["pupsonstuff"],
  artifactRefs: [], decisionRefs: [], outputRefs: [],
  createdAt: "2026-10-18T20:00:00.000Z",
  updatedAt: "2026-10-18T20:00:00.000Z",
} satisfies JhadinaWorkSession;

function request(userId?: string) {
  return new NextRequest("https://jhadina.example/api/jhadina/work-sessions/ws-1/projection", {
    headers: userId ? { "x-jhadina-user-id": userId } : {},
  });
}

function task(status: WorkSessionTask["status"], ownerUserId = "owner-a"): WorkSessionTask {
  return {
    id: "task-1", workSessionId: id, ownerUserId, domain: "pupsonstuff",
    capability: "preview.inspect", status, authorityRef: "evidence-only",
    idempotencyKey: "idem-1", correlationId: "corr-1", dependencyIds: [],
    inputRefs: [], outputRefs: [], attempt: 0, maxAttempts: 2,
    version: 1, createdAt: "2026-10-18T20:00:00.000Z",
    updatedAt: "2026-10-18T20:00:00.000Z",
    ...(status === "blocked" ? { blockedReason: "Provider not commissioned" } : {}),
  };
}

describe("owner-only WorkSession dashboard read", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.verify.mockResolvedValue({ userId: "owner-a" });
    mocks.database.mockReturnValue({});
    mocks.session.mockResolvedValue(session);
    mocks.tasks.mockResolvedValue([task("blocked")]);
  });

  it("presents actual canonical blocked-task evidence without authorizing work", async () => {
    const response = await GET(request("owner-a"), params);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const body = await response.json();
    expect(body.coverage).toBe("canonical-work-session-only");
    expect(body.projection.totalTasks).toBe(1);
    expect(body.projection.humanAttentionCount).toBe(1);
    expect(body.projection.attention.humanAttention[0]).toMatchObject({
      kind: "blocked", taskId: "task-1", requiresHuman: true,
      reason: "Provider not commissioned",
    });
    expect(mocks.session).toHaveBeenCalledWith(id);
    expect(mocks.tasks).toHaveBeenCalledWith(id);
  });

  it("refuses anonymous requests and untrusted identity claims before reading storage", async () => {
    expect((await GET(request(), params)).status).toBe(401);
    expect(mocks.session).not.toHaveBeenCalled();
    mocks.verify.mockRejectedValueOnce(new Error("IDENTITY_MISMATCH"));
    expect((await GET(request("intruder"), params)).status).toBe(503);
    expect(mocks.session).not.toHaveBeenCalled();
    mocks.verify.mockResolvedValueOnce({ userId: "owner-b" });
    expect((await GET(request("owner-a"), params)).status).toBe(401);
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it("never reveals foreign sessions or cross-owner task records", async () => {
    mocks.session.mockResolvedValueOnce(null);
    expect((await GET(request("owner-a"), params)).status).toBe(404);
    mocks.session.mockResolvedValueOnce(session);
    mocks.tasks.mockResolvedValueOnce([task("blocked", "owner-b")]);
    const response = await GET(request("owner-a"), params);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("Provider not commissioned");
  });

  it("fails closed on missing storage and malformed IDs", async () => {
    mocks.database.mockReturnValueOnce(null);
    expect((await GET(request("owner-a"), params)).status).toBe(503);
    expect((await GET(request("owner-a"), { params: Promise.resolve({ id: "../foreign" }) })).status).toBe(400);
  });

  it("does not invent active work when there are no task receipts", async () => {
    mocks.tasks.mockResolvedValueOnce([]);
    const response = await GET(request("owner-a"), params);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.projection.totalTasks).toBe(0);
    expect(body.projection.humanAttentionCount).toBe(0);
    expect(body.projection.automaticInFlightCount).toBe(0);
  });
});
