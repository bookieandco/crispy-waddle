import { describe, expect, it } from "vitest";
import {
  SupabaseDirectUploadObjectStore,
  supabaseTusEndpoint,
} from "./supabase-direct-upload-object-store";

describe("supabaseTusEndpoint", () => {
  it("uses the direct storage hostname for hosted Supabase projects", () => {
    expect(supabaseTusEndpoint("https://abc123.supabase.co"))
      .toBe("https://abc123.storage.supabase.co/storage/v1/upload/resumable");
  });

  it("preserves custom origins", () => {
    expect(supabaseTusEndpoint("https://supabase.example.com"))
      .toBe("https://supabase.example.com/storage/v1/upload/resumable");
  });
});

describe("SupabaseDirectUploadObjectStore", () => {
  it("issues a random-path signed grant with the required 6 MiB TUS chunk size", async () => {
    let seenPath = "";
    const client:any = {
      storage: {
        from() {
          return {
            async createSignedUploadUrl(path:string) {
              seenPath = path;
              return { data: { token: "signed-token" }, error: null };
            },
          };
        },
      },
    };
    const store = new SupabaseDirectUploadObjectStore(client, "https://abc.supabase.co");
    const grant = await store.issue({ actorId: "u1", sessionId: "s1", filename: "../fight.mp4" });
    expect(seenPath).toBe("quarantine/u1/s1/fight.mp4");
    expect(grant.token).toBe("signed-token");
    expect(grant.chunkSizeBytes).toBe(6 * 1024 * 1024);
  });

  it("reads exact uploaded object metadata before finalize", async () => {
    const client:any = {
      storage: {
        from() {
          return {
            async list() {
              return {
                data: [{
                  id: "object-id",
                  name: "fight.mp4",
                  metadata: { size: 1234, mimetype: "video/mp4" },
                }],
                error: null,
              };
            },
          };
        },
      },
    };
    const store = new SupabaseDirectUploadObjectStore(client, "https://abc.supabase.co");
    const info = await store.inspect("quarantine/u1/s1/fight.mp4");
    expect(info).toEqual({
      path: "quarantine/u1/s1/fight.mp4",
      sizeBytes: 1234,
      mediaType: "video/mp4",
    });
  });
});
