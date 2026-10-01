import { HttpRestorationRuntimeClient } from "@jhadina/music-core";
import { currentVercelOidcToken } from "../vercel-oidc-runtime";

const DEFAULT_MUSIC_RESTORATION_WORKER_URL =
  "https://xn73vwwekavcc6-8091.proxy.runpod.net/music-restoration";
const DIRECTOR_BONEZ_GATEWAY_URL =
  "https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway";

type MusicRestorationRuntimeSource =
  | "music-environment"
  | "director-environment"
  | "swlc-runtime-binding"
  | "legacy-default";

function cleanBaseUrl(value:string):string {
  return value.replace(/\/+$/, "");
}

function admittedRunpodWorkerUrl(value:unknown):string|undefined {
  if(typeof value!=="string"||!value.trim()) return undefined;
  try{
    const parsed=new URL(value.trim());
    if(
      parsed.protocol!=="https:"
      ||!parsed.hostname.endsWith(".proxy.runpod.net")
      ||parsed.username
      ||parsed.password
    ) return undefined;
    parsed.pathname=parsed.pathname.replace(/\/+$/,"");
    parsed.search="";
    parsed.hash="";
    return cleanBaseUrl(parsed.toString());
  }catch{
    return undefined;
  }
}

async function discoverSharedGpuRuntimeUrl(oidc:string):Promise<string|undefined> {
  if(!oidc) return undefined;
  try{
    const response=await fetch(DIRECTOR_BONEZ_GATEWAY_URL,{
      method:"POST",
      headers:{
        authorization:`Bearer ${oidc}`,
        "content-type":"application/json",
      },
      body:JSON.stringify({action:"hunyuan-runtime-binding"}),
      cache:"no-store",
    });
    if(!response.ok) return undefined;
    const body=await response.json() as {configured?:boolean;baseUrl?:unknown};
    if(body.configured!==true) return undefined;
    return admittedRunpodWorkerUrl(body.baseUrl);
  }catch{
    return undefined;
  }
}

async function musicRuntimeUrl(oidc:string):Promise<{url:string;source:MusicRestorationRuntimeSource}> {
  const explicit=process.env.MUSIC_RESTORATION_WORKER_URL?.trim();
  if(explicit) return {url:cleanBaseUrl(explicit),source:"music-environment"};

  const hunyuan=process.env.DIRECTOR_HUNYUAN_WORKER_URL?.trim();
  if(hunyuan) return {
    url:`${cleanBaseUrl(hunyuan)}/music-restoration`,
    source:"director-environment",
  };

  const discovered=await discoverSharedGpuRuntimeUrl(oidc);
  if(discovered) return {
    url:`${discovered}/music-restoration`,
    source:"swlc-runtime-binding",
  };

  return {url:DEFAULT_MUSIC_RESTORATION_WORKER_URL,source:"legacy-default"};
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
}

type MusicRestorationAuthMode = "static" | "shared-hunyuan" | "vercel-oidc";

async function runtimeConfig(): Promise<{
  url: string;
  token: string;
  authMode: MusicRestorationAuthMode;
  source: MusicRestorationRuntimeSource;
} | null> {
  const staticToken = process.env.MUSIC_RESTORATION_WORKER_TOKEN?.trim() ?? "";
  const sharedHunyuanToken = process.env.DIRECTOR_HUNYUAN_WORKER_TOKEN?.trim() ?? "";
  const oidcToken = await currentVercelOidcToken();
  const token = staticToken || sharedHunyuanToken || oidcToken;
  if (!token) return null;
  const runtime=await musicRuntimeUrl(oidcToken);
  return {
    url: runtime.url,
    source: runtime.source,
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

export async function musicRestorationRuntimeSource(): Promise<MusicRestorationRuntimeSource | "unconfigured"> {
  return (await runtimeConfig())?.source ?? "unconfigured";
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
