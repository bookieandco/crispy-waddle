import { HttpRestorationRuntimeClient } from "@jhadina/music-core";

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

function runtimeConfig(): { url: string; token: string } | null {
  const url = process.env.MUSIC_RESTORATION_WORKER_URL?.trim() ?? "";
  const token = process.env.MUSIC_RESTORATION_WORKER_TOKEN?.trim() ?? "";
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

export function isMusicRestorationRuntimeConfigured(): boolean {
  return runtimeConfig() !== null;
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
