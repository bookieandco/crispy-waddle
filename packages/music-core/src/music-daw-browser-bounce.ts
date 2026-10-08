/**
 * JHADINA-DAW.7.5 — real, SMALL, local browser DRY stereo WAV renderer.
 * Pure CPU PCM mixing; never phones home or executes a VST. Full-length
 * songs and large projects use the existing laptop streaming stem_bounce.py.
 * Any audible unrendered DSP MUST block, not silently disappear.
 */
import {
  musicDawAutomationValue, validateMusicDawSession,
  type MusicDawAsset, type MusicDawSession,
} from "./music-daw-session.js";

const MAX_FRAMES = 60 * 48000;
const MAX_INPUT_BYTES = 32 * 1024 * 1024;
const MAX_TRACKS = 8;
type Source = { view: DataView; offset: number; sampleRate: number; channels: number;
  frames: number; bytesPerSample: number; format: number; bits: number };

function fail(reason: string): never { throw new Error("MUSIC_DAW_BROWSER_BOUNCE_" + reason); }
function label(view: DataView, i: number): string {
  return String.fromCharCode(view.getUint8(i), view.getUint8(i+1),
    view.getUint8(i+2), view.getUint8(i+3));
}
function parseWave(input: Uint8Array): Source {
  if (input.byteLength < 44 || input.byteLength > MAX_INPUT_BYTES) fail("SOURCE_SIZE_INVALID");
  const view=new DataView(input.buffer,input.byteOffset,input.byteLength);
  if (label(view,0)!=="RIFF" || label(view,8)!=="WAVE" ||
      view.getUint32(4,true) + 8 !== input.byteLength) fail("WAV_HEADER_INVALID");
  let format=0,channels=0,rate=0,bits=0,align=0,offset=-1,size=0;
  let foundFmt=false,foundData=false;
  for (let cursor=12;cursor+8<=view.byteLength;) {
    const kind=label(view,cursor);
    const chunkSize=view.getUint32(cursor+4,true);
    const begin=cursor+8,end=begin+chunkSize;
    if (end>view.byteLength) fail("WAV_CHUNK_INVALID");
    if (kind==="fmt ") {
      if (foundFmt || chunkSize<16) fail("WAV_FMT_INVALID");
      foundFmt=true;
      format=view.getUint16(begin,true);
      channels=view.getUint16(begin+2,true);
      rate=view.getUint32(begin+4,true);
      align=view.getUint16(begin+12,true);
      bits=view.getUint16(begin+14,true);
      if (!((format===1 && (bits===16||bits===24)) ||
            (format===3 && bits===32)) ||
          channels<1 || channels>2 || rate<8000 || rate>48000 ||
          align !== channels*(bits/8) ||
          view.getUint32(begin+8,true)!==rate*align) {
        fail("WAV_FORMAT_UNSUPPORTED");
      }
    }
    if (kind==="data") {
      if (foundData) fail("WAV_DUPLICATE_DATA");
      foundData=true;offset=begin;size=chunkSize;
    }
    cursor=end+(chunkSize&1);
  }
  if (!foundFmt || !foundData || offset<0 || size===0 || size%align!==0 ||
      offset+size>input.byteLength || size/align>MAX_FRAMES) fail("WAV_DURATION_INVALID");
  return {view,offset,sampleRate:rate,channels,
    frames:size/align,bytesPerSample:bits/8,format,bits};
}
function readSample(src:Source,frame:number,channel:number):number {
  const i=src.offset+(frame*src.channels+channel)*src.bytesPerSample;
  if (src.format===3) {
    const f=src.view.getFloat32(i,true);
    if (!Number.isFinite(f)) fail("SOURCE_NONFINITE");
    return f;
  }
  if (src.bits===16) return src.view.getInt16(i,true)/32768;
  const u=src.view.getUint8(i) | (src.view.getUint8(i+1)<<8) |
    (src.view.getUint8(i+2)<<16);
  return ((u & 0x800000) ? u-0x1000000 : u)/8388608;
}
function tick(t:number,rate:number):number {
  if (!Number.isFinite(t) || t<0 || t>60) fail("TIME_INVALID");
  const n=Math.round(t*rate);
  if (Math.abs(n/rate-t)>0.51/rate) fail("TIME_NOT_SAMPLE_ALIGNED");
  return n;
}
function pcmFloatStereo(left:Float32Array,right:Float32Array,rate:number):Uint8Array {
  const frames=left.length;
  const wav=new Uint8Array(44+frames*8);
  const dv=new DataView(wav.buffer);
  function put(i:number,s:string){for(let j=0;j<s.length;j++)dv.setUint8(i+j,s.charCodeAt(j));}
  put(0,"RIFF");dv.setUint32(4,wav.byteLength-8,true);put(8,"WAVE");
  put(12,"fmt ");dv.setUint32(16,16,true);
  dv.setUint16(20,3,true);dv.setUint16(22,2,true);
  dv.setUint32(24,rate,true);dv.setUint32(28,rate*8,true);
  dv.setUint16(32,8,true);dv.setUint16(34,32,true);
  put(36,"data");dv.setUint32(40,frames*8,true);
  for(let f=0;f<frames;f++){dv.setFloat32(44+f*8,left[f]!,true);
    dv.setFloat32(48+f*8,right[f]!,true);}
  return wav;
}
async function sha(bytes:Uint8Array):Promise<string>{
  const ab=new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const hash=new Uint8Array(await crypto.subtle.digest("SHA-256",ab));
  return Array.from(hash).map(v=>v.toString(16).padStart(2,"0")).join("");
}
export interface MusicDawBrowserBounceReceipt {
  schema:"jhadina-music-daw-browser-dry-bounce/v1";
  caseId:string; revision:number; channels:2; sampleRate:number;
  sampleCount:number; outputSha256:string;
  sourceSha256:Record<string,string>; peak:number;
  peakAboveFullScale:boolean; tracksAudible:string[];
  operationClass:"non-destructive-local-dry-bounce";
  pluginsExecuted:false; eqExecuted:false; compressionExecuted:false;
  sourceImmutable:true; restorationCertified:false; needsListeningReview:true;
}
export async function renderMusicDawBrowserDryWav(
  session:MusicDawSession, assets:MusicDawAsset[],
  sources:Record<string,Uint8Array>,
):Promise<{bytes:Uint8Array;receipt:MusicDawBrowserBounceReceipt}> {
  validateMusicDawSession(session,session.caseId,assets);
  if (session.revision<1) fail("SAVE_PROJECT_FIRST");
  const solo=session.tracks.some(t=>t.solo&&!t.mute);
  const live=session.tracks.filter(t=>!t.mute&&(!solo||t.solo)&&t.clips.length>0);
  if (!live.length || live.length>MAX_TRACKS) fail("TRACK_COUNT_LIMIT");
  const assetMap=new Map(assets.map(a=>[a.id,a]));
  const decoded=new Map<string,Source>();
  let total=0,rate=0,frames=0;
  for(const track of live){
    if (track.compressor.enabled || Object.values(track.eq).some(v=>v!==0) ||
       track.pluginRack?.some(x=>x.enabled)) fail("ACTIVE_DSP_USE_LAPTOP_RENDER");
    const bytes=sources[track.artifactId],asset=assetMap.get(track.artifactId);
    if (!bytes || !asset || !["audio/wav","audio/x-wav"].includes(asset.mimeType.toLowerCase()))
      fail("VERIFIED_WAV_SOURCE_REQUIRED");
    total+=bytes.byteLength;
    if (total>MAX_INPUT_BYTES) fail("TOTAL_SOURCE_BYTES_LIMIT");
    if (await sha(bytes)!==track.sourceSha256.toLowerCase()) fail("SOURCE_SHA_MISMATCH");
    const source=parseWave(bytes);
    if (source.frames!==asset.sampleCount || source.sampleRate!==asset.sampleRate)
      fail("SOURCE_TIMEBASE_MISMATCH");
    if (!rate) rate=source.sampleRate;
    if (rate!==source.sampleRate) fail("MIX_SAMPLE_RATE_MISMATCH");
    decoded.set(track.artifactId,source);
    for(const clip of track.clips) {
      const start=tick(clip.startSeconds,rate);
      const end=tick(clip.endSeconds,rate);
      const off=tick(clip.sourceOffsetSeconds,rate);
      if(start>=end || off+end-start>source.frames)fail("CLIP_SOURCE_OUT_OF_BOUNDS");
      frames=Math.max(frames,end);
    }
  }
  if(!frames||frames>MAX_FRAMES)fail("RENDER_TOO_LONG_USE_LAPTOP");
  const left=new Float32Array(frames),right=new Float32Array(frames);
  let peak=0;
  for(const track of live){
    const source=decoded.get(track.artifactId)!;
    for(const clip of track.clips){
      const start=tick(clip.startSeconds,rate),end=tick(clip.endSeconds,rate);
      const off=tick(clip.sourceOffsetSeconds,rate);
      const fadeIn=tick(clip.fadeInSeconds,rate);
      const fadeOut=tick(clip.fadeOutSeconds,rate);
      if(fadeIn>end-start || fadeOut>end-start)fail("FADE_OUT_OF_BOUNDS");
      for(let i=start;i<end;i++){
        const elapsed=i-start,remaining=end-i;
        const envelope=Math.max(0,Math.min(1,
          fadeIn ? elapsed/fadeIn : 1,fadeOut ? remaining/fadeOut : 1));
        const t=i/rate;
        const db=musicDawAutomationValue(track,"gainDb",t);
        const pan=musicDawAutomationValue(track,"pan",t);
        const gain=Math.pow(10,db/20)*envelope;
        const leftGain=gain*(pan<=0?1:Math.cos(pan*Math.PI/2));
        const rightGain=gain*(pan>=0?1:Math.cos(-pan*Math.PI/2));
        const frame=off+elapsed;
        const l=readSample(source,frame,0);
        const r=source.channels===2?readSample(source,frame,1):l;
        left[i]=left[i]!+l*leftGain;
        right[i]=right[i]!+r*rightGain;
        if(!Number.isFinite(left[i])||!Number.isFinite(right[i]))
          fail("MIX_NONFINITE");
      }
    }
  }
  for(let i=0;i<frames;i++)peak=Math.max(peak,Math.abs(left[i]!),Math.abs(right[i]!));
  const bytes=pcmFloatStereo(left,right,rate);
  const receipt:MusicDawBrowserBounceReceipt={
    schema:"jhadina-music-daw-browser-dry-bounce/v1",
    caseId:session.caseId,revision:session.revision,channels:2,
    sampleRate:rate,sampleCount:frames,outputSha256:await sha(bytes),
    sourceSha256:Object.fromEntries(live.map(t=>[t.artifactId,t.sourceSha256])),
    peak,peakAboveFullScale:peak>1,tracksAudible:live.map(t=>t.artifactId),
    operationClass:"non-destructive-local-dry-bounce",
    pluginsExecuted:false,eqExecuted:false,compressionExecuted:false,
    sourceImmutable:true,restorationCertified:false,needsListeningReview:true,
  };
  return {bytes,receipt};
}
