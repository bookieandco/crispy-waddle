import { HttpRestorationRuntimeClient } from "@jhadina/music-core";
import { currentVercelOidcToken } from "../vercel-oidc-runtime";

/** No hard-coded RunPod pod: the old ID disappeared; never advertise a dead URL. */
function musicRuntimeUrl(): string | null {
  const explicit=process.env.MUSIC_RESTORATION_WORKER_URL?.trim();
  if(explicit) return explicit.replace(/\/+$/, "");

  const hunyuan=process.env.DIRECTOR_HUNYUAN_WORKER_URL?.trim();
  if(hunyuan) return hunyuan.replace(/\/+$/, "")+"/music-restoration";

  return null;
}

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
  optionalModels?: {
    deepDrums: boolean;
    basicPitchMidi: boolean;
    demucs6s: boolean;
    ddspTimbre: boolean;
    vocalAdlibs: boolean;
  };
}

type MusicRestorationAuthMode = "static" | "shared-hunyuan" | "vercel-oidc";

async function runtimeConfig(): Promise<{ url: string; token: string; authMode: MusicRestorationAuthMode } | null> {
  const staticToken = process.env.MUSIC_RESTORATION_WORKER_TOKEN?.trim() ?? "";
  const sharedHunyuanToken = process.env.DIRECTOR_HUNYUAN_WORKER_TOKEN?.trim() ?? "";
  const oidcToken = staticToken || sharedHunyuanToken ? "" : await currentVercelOidcToken();
  const token = staticToken || sharedHunyuanToken || oidcToken;
  const url=musicRuntimeUrl();
  if (!token || !url) return null;
  return {
    url,
    token,
    authMode: staticToken
      ? "static"
      : sharedHunyuanToken
        ? "shared-hunyuan"
        : "vercel-oidc",
  };
}

export async function isMusicRestorationRuntimeConfigured(): Promise<boolean> {
  return (await runtimeConfig()) !== null;
}

export async function musicRestorationRuntimeAuthMode(): Promise<MusicRestorationAuthMode | "unconfigured"> {
  return (await runtimeConfig())?.authMode ?? "unconfigured";
}

export async function createMusicRestorationRuntimeClient(): Promise<HttpRestorationRuntimeClient> {
  const config = await runtimeConfig();
  if (!config) throw new Error("MUSIC_RESTORATION_WORKER_NOT_CONFIGURED");
  return new HttpRestorationRuntimeClient(config.url, config.token);
}

export async function getMusicRestorationRuntimeHealth(
  fetcher: typeof fetch = fetch,
): Promise<MusicRestorationRuntimeHealth> {
  const config = await runtimeConfig();
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
