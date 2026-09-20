import { describe, expect, it } from "vitest";
import {
  databaseReportReady,
  evaluateUploadProductionReadiness,
  probeUploadService,
} from "./upload-production-readiness";

const readyReport = {
  schemaVersion: "jllm-18s-v1",
  tables: {
    intelligenceAssets: true,
    subsystemInbox: true,
    perceptionJobs: true,
    uploadSessions: true,
    cleanupReceipts: true,
  },
  storage: {
    intakeBucket: true,
    private: true,
    fileSizeLimit: 512 * 1024 * 1024,
    mimePolicy: true,
  },
  functions: {
    enqueuePerception: true,
    claimPerception: true,
    requestFinalize: true,
    claimFinalize: true,
    renewFinalize: true,
    retryFinalize: true,
    claimCleanup: true,
    orphanDiscovery: true,
  },
};

describe("databaseReportReady", () => {
  it("requires every upload table, function, and bucket invariant", () => {
    expect(databaseReportReady(readyReport)).toBe(true);
    expect(databaseReportReady({
      ...readyReport,
      storage: { ...readyReport.storage, private: false },
    })).toBe(false);
  });
});

describe("probeUploadService", () => {
  it("treats a POST-only 405 endpoint as reachable", async () => {
    const result = await probeUploadService({
      url: "https://worker.test/perceive",
      fetchImpl: async () => new Response(null, { status: 405 }),
    });
    expect(result.reachable).toBe(true);
  });

  it("fails closed on auth failure and insecure production URLs", async () => {
    await expect(probeUploadService({
      url: "https://worker.test/perceive",
      fetchImpl: async () => new Response(null, { status: 401 }),
    })).resolves.toMatchObject({ reachable: false, detail: "auth_failed" });

    await expect(probeUploadService({
      url: "http://worker.test/perceive",
      fetchImpl: async () => new Response(null, { status: 200 }),
    })).resolves.toMatchObject({ reachable: false, detail: "insecure_url" });
  });
});

describe("evaluateUploadProductionReadiness", () => {
  it("returns ready only when config, database, scanner and perception all pass", async () => {
    const client:any = {
      async rpc(name:string) {
        expect(name).toBe("jhadina_upload_readiness");
        return { data: readyReport, error: null };
      },
    };
    const env:any = {
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      JHADINA_MEDIA_SCANNER_URL: "https://scanner.test/scan",
      JHADINA_PERCEPTION_WORKER_URL: "https://perception.test/perceive",
      CRON_SECRET: "secret",
    };
    const result = await evaluateUploadProductionReadiness({
      client,
      env,
      fetchImpl: async () => new Response(null, { status: 405 }),
    });
    expect(result.ready).toBe(true);
    expect(result.level).toBe("ready");
  });

  it("returns not_ready when the upload migrations are absent", async () => {
    const client:any = {
      async rpc() {
        return { data: null, error: { message: "function public.jhadina_upload_readiness() does not exist" } };
      },
    };
    const result = await evaluateUploadProductionReadiness({
      client,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        JHADINA_MEDIA_SCANNER_URL: "https://scanner.test/scan",
        JHADINA_PERCEPTION_WORKER_URL: "https://perception.test/perceive",
        CRON_SECRET: "secret",
      } as any,
      fetchImpl: async () => new Response(null, { status: 405 }),
    });
    expect(result.ready).toBe(false);
    expect(result.database.ready).toBe(false);
  });
});
