import { HttpRestorationRuntimeClient } from "@jhadina/music-core";
import { createClient as createSupabaseServerClient } from "../supabase/server";

const DEFAULT_MUSIC_RESTORATION_WORKER_URL =
  "https://xn73vwwekavcc6-8091.proxy.runpod.net/music-restoration";

export interface MusicRestorationRuntimeHealth {
  status?: string;
  productionReady?: boolean;
  reasons?: string[];
  authMode?: string;
  ffmpegReady?: boolean;
  ffprobeReady?: boolean;
  demucsReady?: boolean;
  torchReady?: boolean;
  cudaReady?: boolean;
  demucsDevice?: string;
  demucsModel?: string;
  demucsVersion?: string;
  librosaReady?: boolean;
  numpyReady?: boolean;
  outputDirWritable?: boolean;
}

export interface MusicRestorationRuntimeLiveness {
  reachable: boolean;
  status: "live" | "unavailable";
  service?: string;
  httpStatus?: number;
}

type MachineAuthMode = "static" | "vercel-oidc";

function workerUrl(): string {
  return (process.env.MUSIC_RESTORATION_WORKER_URL?.trim()
    || DEFAULT_MUSIC_RESTORATION_WORKER_URL).replace(/\/+$/, "");
}

function machineRuntimeConfig(): { url: string; token: string; authMode: MachineAuthMode } | null {
  const staticToken = process.env.MUSIC_RESTORATION_WORKER_TOKEN?.trim() ?? "";
  const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim() ?? "";
  const token = staticToken || oidcToken;
  if (!token) return null;
  return {
    url: workerUrl(),
    token,
    authMode: staticToken ? "static" : "vercel-oidc",
  };
}

export function isMusicRestorationRuntimeConfigured(): boolean {
  return machineRuntimeConfig() !== null;
}

export function musicRestorationRuntimeAuthMode(): "static" | "vercel-oidc" | "unconfigured" {
  return machineRuntimeConfig()?.authMode ?? "unconfigured";
}

/** Machine/background runtime. Interactive requests should prefer the user-scoped helper below. */
export function createMusicRestorationRuntimeClient(): HttpRestorationRuntimeClient {
  const config = machineRuntimeConfig();
  if (!config) throw new Error("MUSIC_RESTORATION_WORKER_NOT_CONFIGURED");
  return new HttpRestorationRuntimeClient(config.url, config.token);
}

/**
 * Interactive runtime client.
 *
 * Static/Vercel machine credentials take priority when configured. Otherwise
 * the request's already-verified Supabase session is forwarded to the worker.
 * The worker independently validates that token with Supabase Auth and requires
 * X-Jhadina-User-Id to match the token subject.
 */
export async function createRequestMusicRestorationRuntimeClient(
  expectedUserId: string,
): Promise<HttpRestorationRuntimeClient> {
  const machine = machineRuntimeConfig();
  if (machine) {
    return new HttpRestorationRuntimeClient(machine.url, machine.token);
  }

  const supabase = await createSupabaseServerClient();
  const [claimsResult, sessionResult] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.auth.getSession(),
  ]);
  if (claimsResult.error || sessionResult.error) {
    throw new Error("MUSIC_RESTORATION_SUPABASE_SESSION_UNAVAILABLE");
  }

  const claims = claimsResult.data?.claims as Record<string, unknown> | undefined;
  const session = sessionResult.data?.session;
  const subject = typeof claims?.sub === "string" ? claims.sub : "";
  const role = typeof claims?.role === "string" ? claims.role : "";
  const sessionUserId = session?.user?.id ?? "";
  const accessToken = session?.access_token?.trim() ?? "";

  if (
    !expectedUserId
    || subject !== expectedUserId
    || sessionUserId !== expectedUserId
    || role !== "authenticated"
    || !accessToken
  ) {
    throw new Error("MUSIC_RESTORATION_SUPABASE_SESSION_IDENTITY_MISMATCH");
  }

  return new HttpRestorationRuntimeClient(
    workerUrl(),
    accessToken,
    fetch,
    expectedUserId,
  );
}

export async function getMusicRestorationRuntimeHealth(
  fetcher: typeof fetch = fetch,
): Promise<MusicRestorationRuntimeHealth> {
  const config = machineRuntimeConfig();
  if (!config) throw new Error("MUSIC_RESTORATION_WORKER_NOT_CONFIGURED");
  const response = await fetcher(`${config.url}/health`, {
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`MUSIC_RESTORATION_WORKER_HEALTH_FAILED:${response.status}:${detail}`);
  }
  return response.json() as Promise<MusicRestorationRuntimeHealth>;
}

export async function getMusicRestorationRuntimeLiveness(
  fetcher: typeof fetch = fetch,
): Promise<MusicRestorationRuntimeLiveness> {
  try {
    const response = await fetcher(`${workerUrl()}/health/live`, {
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) {
      return { reachable: false, status: "unavailable", httpStatus: response.status };
    }
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    return {
      reachable: body.status === "live",
      status: body.status === "live" ? "live" : "unavailable",
      service: typeof body.service === "string" ? body.service : undefined,
      httpStatus: response.status,
    };
  } catch {
    return { reachable: false, status: "unavailable" };
  }
}
