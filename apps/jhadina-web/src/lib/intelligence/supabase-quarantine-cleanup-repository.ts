import type { SupabaseClient } from "@supabase/supabase-js";

export interface QuarantineCleanupReceiptStore {
  listOrphans(limit: number): Promise<readonly string[]>;
  record(input: {
    objectPath: string;
    reason: "session_terminal" | "orphan";
    sessionId?: string;
  }): Promise<void>;
}

export class SupabaseQuarantineCleanupRepository implements QuarantineCleanupReceiptStore {
  constructor(private readonly client: SupabaseClient) {}

  async listOrphans(limit: number): Promise<readonly string[]> {
    const bounded = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 100)) : 20;
    const { data, error } = await this.client.rpc(
      "list_jhadina_orphan_quarantine_objects",
      { p_limit: bounded },
    );
    if (error) throw error;
    if (!Array.isArray(data)) return Object.freeze([]);
    return Object.freeze(
      data
        .map((row: unknown) =>
          row && typeof row === "object" && "object_path" in row
            ? String((row as { object_path: unknown }).object_path)
            : "",
        )
        .filter((path: string) => path.startsWith("quarantine/")),
    );
  }

  async record(input: {
    objectPath: string;
    reason: "session_terminal" | "orphan";
    sessionId?: string;
  }): Promise<void> {
    if (!input.objectPath.startsWith("quarantine/")) {
      throw new Error("QUARANTINE_CLEANUP_PATH_INVALID");
    }
    const { error } = await this.client
      .from("jhadina_quarantine_cleanup_receipts")
      .upsert({
        object_path: input.objectPath,
        reason: input.reason,
        session_id: input.sessionId ?? null,
      }, {
        onConflict: "object_path,reason",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }
}
