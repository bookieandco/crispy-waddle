import { describe, expect, it } from "vitest";
import { SupabaseQuarantineCleanupRepository } from "./supabase-quarantine-cleanup-repository";

describe("SupabaseQuarantineCleanupRepository", () => {
  it("filters orphan discovery to quarantine paths", async () => {
    const client:any = {
      async rpc() {
        return {
          data: [
            { object_path: "quarantine/u1/s1/a.mp4" },
            { object_path: "trusted/u1/s1/a.mp4" },
          ],
          error: null,
        };
      },
    };
    const repo = new SupabaseQuarantineCleanupRepository(client);
    await expect(repo.listOrphans(20)).resolves.toEqual([
      "quarantine/u1/s1/a.mp4",
    ]);
  });

  it("records cleanup idempotently and rejects trusted paths", async () => {
    let row:any;
    const client:any = {
      from() {
        return {
          async upsert(value:any) {
            row = value;
            return { error: null };
          },
        };
      },
    };
    const repo = new SupabaseQuarantineCleanupRepository(client);
    await repo.record({
      objectPath: "quarantine/u1/s1/a.mp4",
      reason: "orphan",
    });
    expect(row.reason).toBe("orphan");
    await expect(repo.record({
      objectPath: "trusted/u1/s1/a.mp4",
      reason: "orphan",
    })).rejects.toThrow("PATH_INVALID");
  });
});
