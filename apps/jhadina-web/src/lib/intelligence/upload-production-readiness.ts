import type { SupabaseClient } from "@supabase/supabase-js";

export type ReadinessLevel = "ready" | "degraded" | "not_ready";

export type UploadDatabaseReadiness = {
  schemaVersion?: string;
  tables?: Record<string, boolean>;
  storage?: {
    intakeBucket?: boolean;
    private?: boolean;
    fileSizeLimit?: number;
    mimePolicy?: boolean;
  };
  functions?: Record<string, boolean>;
};

export type UploadServiceProbe = {
  configured: boolean;
  reachable: boolean;
  status?: number;
  detail?: string;
};

export type UploadProductionReadiness = {
  level: ReadinessLevel;
  ready: boolean;
  config: Record<string, boolean>;
  database: {
    reachable: boolean;
    ready: boolean;
    detail?: string;
    report?: UploadDatabaseReadiness;
  };
  services: {
    scanner: UploadServiceProbe;
    perception: UploadServiceProbe;
  };
  warnings: readonly string[];
};

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JHADINA_MEDIA_SCANNER_URL",
  "JHADINA_PERCEPTION_WORKER_URL",
  "CRON_SECRET",
] as const;

function allTrue(values: Record<string, boolean> | undefined): boolean {
  return !!values && Object.values(values).length > 0 && Object.values(values).every(Boolean);
}

export function databaseReportReady(report: UploadDatabaseReadiness | undefined): boolean {
  if (!report) return false;
  const storage = report.storage;
  return report.schemaVersion === "jllm-18s-v1"
    && allTrue(report.tables)
    && allTrue(report.functions)
    && storage?.intakeBucket === true
    && storage?.private === true
    && typeof storage.fileSizeLimit === "number"
    && storage.fileSizeLimit >= 512 * 1024 * 1024
    && storage.mimePolicy === true;
}

function configState(env: NodeJS.ProcessEnv): Record<string, boolean> {
  return Object.fromEntries(REQUIRED_ENV.map((key) => [key, !!env[key]?.trim()]));
}

export async function probeUploadService(input: {
  url?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<UploadServiceProbe> {
  const raw = input.url?.trim();
  if (!raw) return { configured: false, reachable: false, detail: "missing_url" };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { configured: true, reachable: false, detail: "invalid_url" };
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return { configured: true, reachable: false, detail: "insecure_url" };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 5000);
  try {
    const response = await fetchImpl(url, {
      method: "HEAD",
      headers: input.token ? { authorization: `Bearer ${input.token}` } : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const authFailure = response.status === 401 || response.status === 403;
    const missing = response.status === 404;
    const serverFailure = response.status >= 500;
    return {
      configured: true,
      reachable: !authFailure && !missing && !serverFailure,
      status: response.status,
      detail:
        authFailure ? "auth_failed" :
        missing ? "not_found" :
        serverFailure ? "server_error" :
        response.status === 429 ? "rate_limited" :
        response.status === 405 ? "reachable_method_not_allowed" :
        "reachable",
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      detail: error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function evaluateUploadProductionReadiness(input: {
  client: SupabaseClient | null;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}): Promise<UploadProductionReadiness> {
  const env = input.env ?? process.env;
  const config = configState(env);
  const warnings: string[] = [];

  if (!env.JHADINA_MEDIA_SCANNER_TOKEN?.trim()) {
    warnings.push("MEDIA_SCANNER_TOKEN_NOT_CONFIGURED");
  }
  if (!env.JHADINA_PERCEPTION_WORKER_TOKEN?.trim()) {
    warnings.push("PERCEPTION_WORKER_TOKEN_NOT_CONFIGURED");
  }

  let database: UploadProductionReadiness["database"];
  if (!input.client) {
    database = { reachable: false, ready: false, detail: "service_role_client_unavailable" };
  } else {
    try {
      const { data, error } = await input.client.rpc("jhadina_upload_readiness");
      if (error) {
        database = {
          reachable: true,
          ready: false,
          detail: error.message || "readiness_rpc_failed",
        };
      } else {
        const report = data as UploadDatabaseReadiness;
        database = {
          reachable: true,
          ready: databaseReportReady(report),
          report,
        };
      }
    } catch (error) {
      database = {
        reachable: false,
        ready: false,
        detail: error instanceof Error ? error.message : "database_probe_failed",
      };
    }
  }

  const [scanner, perception] = await Promise.all([
    probeUploadService({
      url: env.JHADINA_MEDIA_SCANNER_URL,
      token: env.JHADINA_MEDIA_SCANNER_TOKEN,
      fetchImpl: input.fetchImpl,
    }),
    probeUploadService({
      url: env.JHADINA_PERCEPTION_WORKER_URL,
      token: env.JHADINA_PERCEPTION_WORKER_TOKEN,
      fetchImpl: input.fetchImpl,
    }),
  ]);

  const configReady = Object.values(config).every(Boolean);
  const ready = configReady && database.ready && scanner.reachable && perception.reachable;
  const degraded = !ready
    && configReady
    && database.ready
    && (scanner.reachable || perception.reachable);

  return Object.freeze({
    level: ready ? "ready" : degraded ? "degraded" : "not_ready",
    ready,
    config: Object.freeze(config),
    database: Object.freeze(database),
    services: Object.freeze({
      scanner: Object.freeze(scanner),
      perception: Object.freeze(perception),
    }),
    warnings: Object.freeze(warnings),
  });
}
