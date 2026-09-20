import { describe, expect, it } from "vitest";
import {
  DirectUploadRuntime,
  type DirectUploadSessionStore,
} from "./production-direct-upload-runtime";
import type { DirectUploadSession } from "./supabase-direct-upload-session-repository";

function sessionStore(): DirectUploadSessionStore & { current?: DirectUploadSession } {
  const store:any = {
    current: undefined,
    async create(input:any) {
      const now = "2026-09-20T06:00:00Z";
      store.current = {
        ...input,
        status: "issued",
        finalizeAvailableAt: now,
        finalizeAttempt: 0,
        finalizeMaxAttempts: 4,
        cleanupStatus: "none",
        cleanupAvailableAt: now,
        cleanupAttempt: 0,
        createdAt: now,
        updatedAt: now,
      };
      return store.current;
    },
    async get(actorId:string, id:string) {
      return store.current?.actorId === actorId && store.current?.id === id
        ? store.current
        : undefined;
    },
    async requestFinalize(input:any) {
      if (!store.current) return undefined;
      store.current = {
        ...store.current,
        status: "finalize_queued",
        finalizeRequestedAt: "2026-09-20T06:01:00Z",
        finalizeAvailableAt: "2026-09-20T06:01:00Z",
        finalizeMaxAttempts: input.maxAttempts,
      };
      return store.current;
    },
  };
  return store;
}

describe("DirectUploadRuntime", () => {
  it("issues an actor-scoped resumable session without receiving file bytes", async () => {
    const sessions = sessionStore();
    const runtime = new DirectUploadRuntime(
      sessions,
      {
        async issue(input) {
          return {
            quarantinePath: `quarantine/${input.actorId}/${input.sessionId}/fight.mp4`,
            token: "token",
            tusEndpoint: "https://project.storage.supabase.co/storage/v1/upload/resumable",
            chunkSizeBytes: 6 * 1024 * 1024,
          };
        },
      },
      "sensitive",
      () => new Date("2026-09-20T06:00:00Z"),
      () => "session-1",
      4,
    );

    const result = await runtime.issue({
      actorId:"u1",
      filename:"fight.mp4",
      declaredMediaType:"video/mp4",
      byteLength:100 * 1024 * 1024,
      privacyClass:"sensitive",
      intent:"analyze this boxing match",
    });

    expect(result.session.id).toBe("session-1");
    expect(result.upload.path).toBe("quarantine/u1/session-1/fight.mp4");
    expect(result.upload.resumable.headers["x-signature"]).toBe("token");
    expect(result.upload.resumable.chunkSizeBytes).toBe(6 * 1024 * 1024);
  });

  it("queues finalization instead of scanning or hashing in the request", async () => {
    const sessions = sessionStore();
    let issueCalls = 0;
    const runtime = new DirectUploadRuntime(
      sessions,
      {
        async issue(input) {
          issueCalls += 1;
          return {
            quarantinePath:`quarantine/${input.actorId}/${input.sessionId}/doc.pdf`,
            token:"t",
            tusEndpoint:"tus",
            chunkSizeBytes:6*1024*1024,
          };
        },
      },
      "sensitive",
      () => new Date("2026-09-20T06:00:00Z"),
      () => "s1",
      5,
    );

    await runtime.issue({
      actorId:"u1",filename:"doc.pdf",declaredMediaType:"application/pdf",
      byteLength:1234,privacyClass:"sensitive",
    });
    const result = await runtime.requestFinalize({actorId:"u1",sessionId:"s1"});

    expect(issueCalls).toBe(1);
    expect(result.status).toBe("finalize_queued");
    expect(result.finalizeMaxAttempts).toBe(5);
    expect(result.scanSha256).toBeUndefined();
    expect(result.assetId).toBeUndefined();
    expect(result.perceptionJobId).toBeUndefined();
  });

  it("is idempotent while a finalization request is already queued", async () => {
    const sessions = sessionStore();
    let queueCalls = 0;
    const original = sessions.requestFinalize.bind(sessions);
    sessions.requestFinalize = async (input) => {
      queueCalls += 1;
      return original(input);
    };
    const runtime = new DirectUploadRuntime(
      sessions,
      {
        async issue(input) {
          return {
            quarantinePath:`quarantine/${input.actorId}/${input.sessionId}/x.pdf`,
            token:"t",tusEndpoint:"tus",chunkSizeBytes:6*1024*1024,
          };
        },
      },
      "sensitive",
      () => new Date("2026-09-20T06:00:00Z"),
      () => "s1",
    );

    await runtime.issue({
      actorId:"u1",filename:"x.pdf",declaredMediaType:"application/pdf",
      byteLength:1000,privacyClass:"sensitive",
    });
    await runtime.requestFinalize({actorId:"u1",sessionId:"s1"});
    await runtime.requestFinalize({actorId:"u1",sessionId:"s1"});

    expect(queueCalls).toBe(1);
  });
});
