import { currentVercelOidcToken } from "@/lib/vercel-oidc-runtime";

const VOICE_GATEWAY_URL="https://kqbkaozfjubkjevdfvic.supabase.co/functions/v1/jhadina-director-bonez-gateway";

export interface NativeJhadinaVoiceRuntimeConfig {
  baseUrl:string;
  token:string;
  source:"environment"|"swlc-runtime-binding";
}

function cleanBaseUrl(value:string):string{
  return value.replace(/\/+$/,"");
}

function admittedDiscoveredVoiceUrl(value:unknown):string|undefined{
  if(typeof value!=="string"||!value.trim()) return undefined;
  try{
    const parsed=new URL(value.trim());
    if(
      parsed.protocol!=="https:"
      ||!parsed.hostname.endsWith("-8095.proxy.runpod.net")
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

async function discoverRuntime():Promise<NativeJhadinaVoiceRuntimeConfig|undefined>{
  const oidc=await currentVercelOidcToken();
  if(!oidc) return undefined;
  try{
    const response=await fetch(VOICE_GATEWAY_URL,{
      method:"POST",
      headers:{
        authorization:`Bearer ${oidc}`,
        "content-type":"application/json",
      },
      body:JSON.stringify({action:"jhadina-voice-runtime-binding"}),
      cache:"no-store",
      signal:AbortSignal.timeout(12_000),
    });
    if(!response.ok) return undefined;
    const body=await response.json() as {
      configured?:boolean;
      baseUrl?:unknown;
      token?:unknown;
    };
    const baseUrl=admittedDiscoveredVoiceUrl(body.baseUrl);
    const token=typeof body.token==="string"?body.token.trim():"";
    if(body.configured!==true||!baseUrl||!token) return undefined;
    return {baseUrl,token,source:"swlc-runtime-binding"};
  }catch{
    return undefined;
  }
}

export async function nativeJhadinaVoiceRuntimeConfig():Promise<NativeJhadinaVoiceRuntimeConfig|undefined>{
  const explicitUrl=(process.env.JHADINA_VOICE_URL??"").trim();
  const explicitToken=(process.env.JHADINA_VOICE_TOKEN??"").trim();
  const pinned=["1","true","yes","on"].includes(
    (process.env.JHADINA_VOICE_URL_PINNED??"").trim().toLowerCase(),
  );

  if(pinned){
    return explicitUrl&&explicitToken
      ?{baseUrl:cleanBaseUrl(explicitUrl),token:explicitToken,source:"environment"}
      :undefined;
  }

  const discovered=await discoverRuntime();
  if(discovered) return discovered;
  if(explicitUrl&&explicitToken){
    return {baseUrl:cleanBaseUrl(explicitUrl),token:explicitToken,source:"environment"};
  }
  return undefined;
}
