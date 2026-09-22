import type { DecodeRequest, MediaDecoderAdapter } from './media-decoder-adapter.js';

export interface ConversationProsodyObservation {
  assetId: string;
  observedAt: string;
  windowCount: number;
  durationSeconds: number;
  rmsMean: number;
  rmsPeak: number;
  energyVariance: number;
  pauseRatio: number;
  pitchMeanHz?: number;
  pitchVariance?: number;
  interpretationLimits: readonly string[];
}

/**
 * Analyze recorded conversation audio after it has been decoded by the canonical
 * media decoder (production: createNodeFfmpegDecoder). This intentionally
 * measures acoustic shape only; it does not diagnose emotion, intent, honesty,
 * health, or identity.
 */
export async function observeConversationProsody(
  decoder: MediaDecoderAdapter,
  request: DecodeRequest,
): Promise<ConversationProsodyObservation> {
  const rmsValues:number[]=[];
  const pitches:number[]=[];
  let durationSeconds=0;

  for await (const chunk of decoder.decodeAudio({...request,audioSampleRate:16000})) {
    const pcm=parsePcmRef(chunk.audioRef);
    if(!pcm.length) continue;
    const rms=computeRms(pcm);
    rmsValues.push(rms);
    const pitch=estimatePitch(pcm,16000);
    if(pitch) pitches.push(pitch);
    durationSeconds += Math.max(0,chunk.endSeconds-chunk.startSeconds);
  }

  if(!rmsValues.length) throw new Error('CONVERSATION_PROSODY_NO_AUDIO');
  const rmsMean=mean(rmsValues);
  const rmsPeak=Math.max(...rmsValues);
  const energyVariance=variance(rmsValues,rmsMean);
  const silenceThreshold=Math.max(.008,rmsMean*.35);
  const pauseRatio=rmsValues.filter(v=>v<silenceThreshold).length/rmsValues.length;
  const pitchMeanHz=pitches.length?mean(pitches):undefined;
  const pitchVariance=pitches.length&&pitchMeanHz!==undefined?variance(pitches,pitchMeanHz):undefined;

  return {
    assetId:request.assetId,
    observedAt:new Date().toISOString(),
    windowCount:rmsValues.length,
    durationSeconds,
    rmsMean,
    rmsPeak,
    energyVariance,
    pauseRatio,
    ...(pitchMeanHz?{pitchMeanHz}:{}),
    ...(pitchVariance!==undefined?{pitchVariance}:{}),
    interpretationLimits:[
      'Acoustic measurements are contextual observations only.',
      'Do not infer emotion, intent, truthfulness, health, or identity from acoustic cues alone.',
    ],
  };
}

function parsePcmRef(ref:string):Int16Array{
  const idx=ref.lastIndexOf(':');
  if(idx<0)return new Int16Array();
  const bytes=Buffer.from(ref.slice(idx+1),'base64');
  return new Int16Array(bytes.buffer,bytes.byteOffset,Math.floor(bytes.byteLength/2));
}
function computeRms(samples:Int16Array):number{
  if(!samples.length)return 0;
  let sum=0;for(const s of samples){const v=s/32768;sum+=v*v}
  return Math.sqrt(sum/samples.length);
}
function estimatePitch(samples:Int16Array,sampleRate:number):number|undefined{
  if(samples.length<128)return undefined;
  const step=Math.max(1,Math.floor(samples.length/4096));
  const data:number[]=[];for(let i=0;i<samples.length;i+=step)data.push(samples[i]!/32768);
  const rms=Math.sqrt(data.reduce((sum,v)=>sum+v*v,0)/data.length);
  if(rms<.01)return undefined;
  const effectiveRate=sampleRate/step,minLag=Math.floor(effectiveRate/500),maxLag=Math.min(data.length-1,Math.floor(effectiveRate/70));
  let bestLag=0,best=0;
  for(let lag=minLag;lag<=maxLag;lag++){
    let corr=0,a2=0,b2=0;
    for(let i=0;i<data.length-lag;i++){const a=data[i]!,b=data[i+lag]!;corr+=a*b;a2+=a*a;b2+=b*b}
    const score=corr/Math.sqrt((a2*b2)||1);
    if(score>best){best=score;bestLag=lag}
  }
  return best>.55&&bestLag?effectiveRate/bestLag:undefined;
}
function mean(values:number[]):number{return values.reduce((a,b)=>a+b,0)/values.length}
function variance(values:number[],m:number):number{return values.reduce((sum,v)=>sum+((v-m)**2),0)/values.length}
