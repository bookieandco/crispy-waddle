import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { runMemoryAction } from "./repository.mjs";

class TestD1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("CREATE TABLE jhadina_memory_records (id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,sort_at TEXT NOT NULL,payload TEXT NOT NULL); CREATE INDEX scoped ON jhadina_memory_records(owner_id,kind,status,sort_at DESC);");
  }
  prepare(sql) {
    const bind = (values) => ({
      first: async () => this.sqlite.prepare(sql).get(...values) ?? null,
      all: async () => ({ results: this.sqlite.prepare(sql).all(...values) }),
      run: async () => ({ meta: { changes: this.sqlite.prepare(sql).run(...values).changes } }),
      _sql: sql,
      _values: values,
    });
    return { bind: (...values) => bind(values), ...bind([]) };
  }
  async batch(statements) {
    this.sqlite.exec("BEGIN");
    try {
      const results = statements.map((statement) => ({
        meta: { changes: this.sqlite.prepare(statement._sql).run(...statement._values).changes },
      }));
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}
async function baseline(db, userId = "owner-a") {
  const content = "Owner-approved Jhadina interaction preference: Keep answers concise and direct.";
  const reasoning = await runMemoryAction(db, "createReasoningEvent", { data: {
    userId, timestamp: "2026-10-18T00:00:00Z", userMessage: content,
    observation: { raw: content, extracted: content, timestamp: "2026-10-18T00:00:00Z" },
    classification: { type: "PREFERENCE", confidence: 0.5 },
    systemResponse: "Pending", confidence: 0.5,
  } });
  const candidate = await runMemoryAction(db, "createCandidate", { data: {
    userId, content, type: "PREFERENCE", confidence: 0.5, status: "PENDING",
    createdAt: "2026-10-18T00:00:00Z", reasoningEventId: reasoning.id,
  } });
  return { content, reasoning, candidate };
}
test("D1 gateway preserves owner approval, correction and forget", async () => {
  const db = new TestD1();
  assert.deepEqual(await runMemoryAction(db, "probe"), { ok: true, storage: "cloudflare-d1" });
  const { content, reasoning, candidate } = await baseline(db);
  const memory = await runMemoryAction(db, "createMemory", { data: {
    userId: "owner-a", type: "PREFERENCE", status: "APPROVED",
    content, confidence: 0.5, createdAt: candidate.createdAt,
    approvedAt: "2026-10-18T01:00:00Z", reasoningEventId: reasoning.id,
  } });
  await runMemoryAction(db, "removeCandidate", { id: candidate.id });
  assert.equal((await runMemoryAction(db, "listMemories", { userId: "owner-b" })).length, 0);
  assert.equal((await runMemoryAction(db, "getMemory", { id: memory.id })).status, "APPROVED");
  assert.equal((await runMemoryAction(db, "listCandidates", { userId: "owner-a" })).length, 0);
  const correctedText = "Owner-approved Jhadina interaction preference: Give concrete examples and challenge weak reasoning.";
  const revised = await runMemoryAction(db, "createReasoningEvent", { data: {
    ...reasoning, id: undefined, timestamp: "2026-10-18T02:00:00Z",
    userMessage: correctedText, observation: { raw: correctedText, extracted: correctedText },
  } });
  await assert.rejects(() => runMemoryAction(db, "correctMemory", { params: {
    userId: "owner-b", memoryId: memory.id, content: correctedText, confidence: 0.7,
    reasoningEventId: revised.id, correctedAt: "2026-10-18T03:00:00Z",
  } }), /INVALID_CORRECTION_TARGET/);
  const { retired, replacement } = await runMemoryAction(db, "correctMemory", { params: {
    userId: "owner-a", memoryId: memory.id, content: correctedText, confidence: 0.7,
    reasoningEventId: revised.id, correctedAt: "2026-10-18T03:00:00Z",
  } });
  assert.equal(retired.status, "RETIRED");
  assert.equal(replacement.status, "APPROVED");
  assert.equal(replacement.supersedesMemoryId, memory.id);
  const all = await runMemoryAction(db, "listMemories", { userId: "owner-a" });
  assert.equal(all.filter((item) => item.status === "APPROVED").length, 1);
  assert.equal(all.filter((item) => item.status === "RETIRED").length, 1);
  const forgotten = await runMemoryAction(db, "retireMemory", {
    id: replacement.id, userId: "owner-a", reason: "forgotten",
    revokedAt: "2026-10-18T04:00:00Z",
  });
  assert.equal(forgotten.status, "RETIRED");
  assert.equal((await runMemoryAction(db, "listMemories", { userId: "owner-a" }))
    .filter((item) => item.status === "APPROVED").length, 0);
});
test("D1 refuses memory without a previously reviewed pending candidate", async () => {
  const db = new TestD1();
  await assert.rejects(() => runMemoryAction(db, "createMemory", { data: {
    userId: "owner-a", status: "APPROVED", type: "PREFERENCE",
    content: "A supposed owner preference", confidence: 0.5,
    reasoningEventId: "reason_fake", createdAt: "2026-10-18T00:00:00Z",
  } }), /UNAPPROVED_MEMORY_CANDIDATE/);
  await assert.rejects(() => runMemoryAction(db, "unknown", {}), /ACTION_NOT_SUPPORTED/);
});
