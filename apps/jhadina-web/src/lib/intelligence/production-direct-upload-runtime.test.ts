import { describe, expect, it } from "vitest";
import {
  GovernedAssetRegistry,
  InMemoryIntelligenceAssetStore,
} from "@jhadina/intelligence-core";
import {
  DirectUploadRuntime,
  type DirectUploadSessionStore,
} from "./production-direct-upload-runtime";
import type { DirectUploadSession } from "./supabase-direct-upload-session-repository";

function sessionStore(): DirectUploadSessionStore & { current?: DirectUploadSession; rejected?: string } {
  const store:any = {
    current: undefined,
    async create(input:any) {
      const now = "2026-09-19T00:00:00Z";
      store.current = {
        ...input,
        status: "issued",
        createdAt: now,
        updatedAt: now,
      };
      return store.current;
    },
    async get(actorId:string, id:string) {
      return store.current?.actorId === actorId && store.current?.id === id ? store.current : undefined;
    },
    async claimFinalize(input:any) {
      if (!store.current || store.current.status !== "issued") return undefined;
      store.current = {
        ...store.current,
        finalizeLeaseOwner: input.workerId,
        finalizeLeaseToken: "lease-token",
        finalizeLeaseExpiresAt: "2026-09-19T01:00:00Z",
      };
      return store.current;
    },
    async renewFinalizeLease() { return store.current; },
    async recordScan(input:any) {
      store.current = { ...store.current, scanSha256: input.sha256, scanAt: input.scannedAt };
      return store.current;
    },
    async complete(input:any) {
      store.current = {
        ...store.current,
        status: "finalized",
        assetId: input.assetId,
        perceptionJobId: input.perceptionJobId,
        finalizeLeaseOwner: undefined,
        finalizeLeaseToken: undefined,
        finalizeLeaseExpiresAt: undefined,
      };
      return store.current;
    },
    async reject(input:any) {
      store.rejected = input.error;
      store.current = { ...store.current, status: "rejected", lastError: input.error };
      return store.current;
    },
    async release(input:any) {
      store.current = {
        ...store.current,
        lastError: input.error,
        finalizeLeaseOwner: undefined,
        finalizeLeaseToken: undefined,
        finalizeLeaseExpiresAt: undefined,
      };
      return store.current;
    },
  };
  return store;
}

function jobs() {
  let job:any;
  return {
    async enqueue(input:any) {
      job = {
        id: input.id,
        actorId: input.actorId,
        assetId: input.assetId,
        status: "queued",
        attempt: 0,
        maxAttempts: input.maxAttempts,
        availableAt: "2026-09-19T00:00:00Z",
        createdAt: "2026-09-19T00:00:00Z",
        updatedAt: "2026-09-19T00:00:00Z",
      };
      return job;
    },
    async get(actorId:string,id:string) {
      return job?.actorId === actorId && job?.id === id ? job : undefined;
    },
  } as any;
}

describe("DirectUploadRuntime", () => {
  it("issues an actor-scoped resumable upload session without receiving file bytes", async () => {
    const sessions = sessionStore();
    const runtime = new DirectUploadRuntime(
      { async scan(){throw new Error("not called")} },
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
        async inspect(){return undefined},
        async scanUri(){return "signed"},
      },
      { async promote(){return {assetRef:"trusted"}} },
      new GovernedAssetRegistry(new InMemoryIntelligenceAssetStore()),
      jobs(),
      "sensitive",
      () => new Date("2026-09-19T00:00:00Z"),
      () => "session-1",
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

  it("finalizes only after exact stored metadata and a clean scanner result", async () => {
    const sessions = sessionStore();
    const hash = "a".repeat(64);
    let promoted = false;
    const runtime = new DirectUploadRuntime(
      {
        async scan(input) {
          return {
            assetId: input.assetId,
            sha256: hash,
            verdict: "clean",
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            reasons: [],
            scannedAt: "2026-09-19T00:01:00Z",
          };
        },
      },
      sessions,
      {
        async issue(input) {
          return { quarantinePath:`quarantine/${input.actorId}/${input.sessionId}/doc.pdf`, token:"t", tusEndpoint:"tus", chunkSizeBytes:6*1024*1024 };
        },
        async inspect(path) { return { path, sizeBytes: 1234, mediaType: "application/pdf" }; },
        async scanUri() { return "https://signed.test/doc.pdf"; },
      },
      { async promote(){promoted=true;return {assetRef:"supabase://jhadina-intake-private/trusted/u1/session/doc.pdf"}} },
      new GovernedAssetRegistry(new InMemoryIntelligenceAssetStore(), () => new Date("2026-09-19T00:02:00Z")),
      jobs(),
      "sensitive",
      () => new Date("2026-09-19T00:00:00Z"),
      () => sessions.current ? "worker-id" : "session-id",
    );

    const issued = await runtime.issue({
      actorId:"u1",filename:"doc.pdf",declaredMediaType:"application/pdf",
      byteLength:1234,privacyClass:"sensitive",
    });
    const result = await runtime.finalize({actorId:"u1",sessionId:issued.session.id});

    expect(promoted).toBe(true);
    expect(result.session.status).toBe("finalized");
    expect(result.session.scanSha256).toBe(hash);
    expect(result.perceptionJob.status).toBe("queued");
  });

  it("rejects a stored object whose size differs from the issued session", async () => {
    const sessions = sessionStore();
    const runtime = new DirectUploadRuntime(
      { async scan(){throw new Error("must not scan")} },
      sessions,
      {
        async issue(input) { return { quarantinePath:`quarantine/${input.actorId}/${input.sessionId}/x.pdf`, token:"t", tusEndpoint:"tus", chunkSizeBytes:6*1024*1024 }; },
        async inspect(path) { return { path, sizeBytes: 999, mediaType: "application/pdf" }; },
        async scanUri(){throw new Error("must not sign")},
      },
      { async promote(){throw new Error("must not promote")} },
      new GovernedAssetRegistry(new InMemoryIntelligenceAssetStore()),
      jobs(),
      "sensitive",
      () => new Date("2026-09-19T00:00:00Z"),
      (() => { let n=0; return () => n++ === 0 ? "s1" : "w1"; })(),
    );

    await runtime.issue({
      actorId:"u1",filename:"x.pdf",declaredMediaType:"application/pdf",
      byteLength:1000,privacyClass:"sensitive",
    });
    await expect(runtime.finalize({actorId:"u1",sessionId:"s1"}))
      .rejects.toThrow("DIRECT_UPLOAD_SIZE_MISMATCH");
    expect(sessions.rejected).toContain("DIRECT_UPLOAD_SIZE_MISMATCH");
  });
});
