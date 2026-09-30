import { HttpRestorationRuntimeClient } from "@jhadina/music-core";

const DEFAULT_MUSIC_RESTORATION_WORKER_URL =
  "https://xn73vwwekavcc6-8091.proxy.runpod.net/music-restoration";

export interface MusicRestorationRuntimeHealth {
  status?: string;
  productionReady?: boolean;
  reasons?: string[];
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

function runtimeBearerToken(): string {
  return process.env.MUSIC_RESTORATION_WORKER_TOKEN?.trim()
    || process.env.VERCEL_OIDC_TOKEN?.trim()
    || "";
}

function runtimeConfig(): { url: string; token: string; authMode: "static" | "vercel-oidc" } | null {
  const url = process.env.MUSIC_RESTORATION_WORKER_URL?.trim()
    || DEFAULT_MUSIC_RESTORATION_WORKER_URL;
  const staticToken = process.env.MUSIC_RESTORATION_WORKER_TOKEN?.trim() ?? "";
  const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim() ?? "";
  const token = staticToken || oidcToken;
  if (!url || !token) return null;
  return {
    url: url.replace(/\/+$/, ""),
    token,
    authMode: staticToken ? "static" : "vercel-oidc",
  };
}

export function isMusicRestorationRuntimeConfigured(): boolean {
  return runtimeConfig() !== null;
}

export function musicRestorationRuntimeAuthMode(): "static" | "vercel-oidc" | "unconfigured" {
  return runtimeConfig()?.authMode ?? "unconfigured";
}

export function createMusicRestorationRuntimeClient(): HttpRestorationRuntimeClient {
  const config = runtimeConfig();
  if (!config) throw new Error("MUSIC_RESTORATION_WORKER_NOT_CONFIGURED");
  return new HttpRestorationRuntimeClient(config.url, config.token);
}

export async function getMusicRestorationRuntimeHealth(
  fetcher: typeof fetch = fetch,
): Promise<MusicRestorationRuntimeHealth> {
  const config = runtimeConfig();
  if (!config) throw new Error("MUSIC_RESTORATION_WORKER_NOT_CONFIGURED");
  const response = await fetcher(`${config.url}/health`, {
    headers: { Authorization: `Bearer ${runtimeBearerToken()}` },
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`MUSIC_RESTORATION_WORKER_HEALTH_FAILED:${response.status}:${detail}`);
  }
  return response.json() as Promise<MusicRestorationRuntimeHealth>;
}
