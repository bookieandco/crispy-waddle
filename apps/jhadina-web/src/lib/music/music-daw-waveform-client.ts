"use client";
import {
  analyzeMusicDawWaveform,
  type MusicDawAsset, type MusicDawWaveformEnvelope,
} from "@jhadina/music-core";

const MAX_WAV_BYTES=12*1024*1024;

/** Decode only authenticated source-byte SHA-checked short WAVs in the browser.
 * No raw PCM persisted or transmitted to external waveform services.
 * Decoding an unsupported phone/browser rate fails visibly; no fake waveform. */
export async function loadVerifiedMusicDawWaveform(
  asset: MusicDawAsset, url: string, signal?: AbortSignal,
): Promise<MusicDawWaveformEnvelope> {
  if(!["audio/wav","audio/x-wav"].includes(asset.mimeType.toLowerCase())||
     !Number.isInteger(asset.sampleRate)||asset.sampleRate<8000||asset.sampleRate>192000||
     !Number.isSafeInteger(asset.sampleCount)||asset.sampleCount<1||
     !/^[a-f0-9]{64}$/i.test(asset.sha256)||!url){
    throw new Error("MUSIC_DAW_WAVEFORM_WAV_ASSET_REQUIRED");
  }
  const res=await fetch(url,{cache:"no-store",signal});
  if(!res.ok)throw new Error("MUSIC_DAW_WAVEFORM_PRIVATE_AUDIO_UNAVAILABLE");
  const declared=Number(res.headers.get("content-length"));
  if(declared>MAX_WAV_BYTES) {
    await res.body?.cancel();
    throw new Error("MUSIC_DAW_WAVEFORM_USE_DESKTOP_LONG_FORM");
  }
  const buffer=await res.arrayBuffer();
  if(signal?.aborted)throw new Error("MUSIC_DAW_WAVEFORM_CANCELLED");
  if(buffer.byteLength<44||buffer.byteLength>MAX_WAV_BYTES)
    throw new Error("MUSIC_DAW_WAVEFORM_WAV_SIZE_INVALID");
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",buffer)))
    .map(b=>b.toString(16).padStart(2,"0")).join("");
  if(actual!==asset.sha256.toLowerCase())
    throw new Error("MUSIC_DAW_WAVEFORM_SHA256_MISMATCH");
  const context=new AudioContext({sampleRate:asset.sampleRate});
  try{
    // decodeAudioData consumes a detached ArrayBuffer in some browsers.
    const copy=buffer.slice(0);
    const audio=await context.decodeAudioData(copy);
    if(signal?.aborted)throw new Error("MUSIC_DAW_WAVEFORM_CANCELLED");
    if(audio.sampleRate!==asset.sampleRate||audio.length!==asset.sampleCount||
       audio.numberOfChannels<1||audio.numberOfChannels>2)
      throw new Error("MUSIC_DAW_WAVEFORM_DECODED_TIMEBASE_MISMATCH");
    return analyzeMusicDawWaveform(
      Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i)),
      audio.sampleRate,actual,
    );
  }finally{
    await context.close().catch(()=>undefined);
  }
}
