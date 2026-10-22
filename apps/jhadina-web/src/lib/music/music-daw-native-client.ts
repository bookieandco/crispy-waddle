"use client";
import type { MusicDawPluginSlot } from "@jhadina/music-core";
const MAX_INPUT=12*1024*1024;
function toHex(bytes:Uint8Array){return Array.from(bytes).map(v=>v.toString(16).padStart(2,"0")).join("")}
async function hash(bytes:Uint8Array){
  // Copy into a strict ArrayBuffer: TS BufferSource excludes SharedArrayBuffer.
  const raw=new ArrayBuffer(bytes.byteLength);
  new Uint8Array(raw).set(bytes);
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256",raw)));
}
function encode(bytes:Uint8Array){
  let text="";
  for(let offset=0;offset<bytes.length;offset+=32768)
    text+=String.fromCharCode(...bytes.slice(offset,offset+32768));
  return btoa(text);
}
function decode(value:string){
  const text=atob(value),result=new Uint8Array(text.length);
  for(let i=0;i<text.length;i++)result[i]=text.charCodeAt(i);
  return result;
}
/** Browser -> owner laptop loopback. No cloud write and no automatic native
 * plugin execution. Caller explicitly confirms the approved installed effect. */
export async function renderLocalInstalledDawEffect(input:{
  url:string; sourceSha256:string; plugin:MusicDawPluginSlot;
  companionToken:string; ownerApproved:true;
}){
  if(input.companionToken.length<24||
     !/^native-installed:[a-f0-9]{40}$/.test(input.plugin.pluginId)||
     !["vst3","au"].includes(input.plugin.format)||
     !input.plugin.enabled||!input.ownerApproved){
    throw new Error("MUSIC_DAW_NATIVE_PLUGIN_OWNER_APPROVAL_REQUIRED");
  }
  const response=await fetch(input.url,{cache:"no-store"});
  if(!response.ok)throw new Error("MUSIC_DAW_PRIVATE_WAV_UNAVAILABLE");
  const source=new Uint8Array(await response.arrayBuffer());
  if(source.length<44||source.length>MAX_INPUT||
     String.fromCharCode(...source.slice(0,4))!=="RIFF"||
     String.fromCharCode(...source.slice(8,12))!=="WAVE"||
     await hash(source)!==input.sourceSha256.toLowerCase()){
    throw new Error("MUSIC_DAW_NATIVE_INPUT_WAV_HASH_OR_SIZE_INVALID");
  }
  const local=await fetch("http://127.0.0.1:47471/v1/render",{
    method:"POST",
    headers:{"content-type":"application/json",
      "Authorization":"Bearer "+input.companionToken},
    body:JSON.stringify({pluginId:input.plugin.pluginId,
      sourceSha256:input.sourceSha256.toLowerCase(),
      sourceWavBase64:encode(source),ownerApproved:true}),
  });
  const payload=await local.json();
  if(!local.ok||payload.success!==true||!payload.receipt||
     typeof payload.renderedWavBase64!=="string"||
     payload.renderedWavBase64.length>45*1024*1024){
    throw new Error(payload.error||"MUSIC_DAW_LOCAL_RENDER_UNAVAILABLE");
  }
  const wav=decode(payload.renderedWavBase64);
  const outputHash=await hash(wav);
  const receipt=payload.receipt as Record<string,unknown>;
  if(receipt.outputSha256!==outputHash||
     receipt.sourceSha256!==input.sourceSha256.toLowerCase()||
     receipt.pluginId!==input.plugin.pluginId||
     receipt.nativePluginExecuted!==true||
     receipt.sourceImmutable!==true||
     receipt.originalRecovered!==false||
     receipt.restorationCertified!==false||
     receipt.effectIdentityAttested!==false){
    throw new Error("MUSIC_DAW_NATIVE_OUTPUT_RECEIPT_INVALID");
  }
  const bytes=wav.slice().buffer;
  return {wav:new Blob([bytes],{type:"audio/wav"}),receipt,
    sourceSha256:input.sourceSha256.toLowerCase(),outputSha256:outputHash,
    pluginId:input.plugin.pluginId};
}
