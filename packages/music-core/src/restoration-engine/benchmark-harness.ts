import {
  createBlindAliases,
  type RestorationBenchmarkCase,
  type RestorationBenchmarkMetricSnapshot,
  type RestorationBenchmarkObjectiveMetrics,
} from "./benchmark-contracts.js";

export interface BenchmarkAlignment {
  candidateDelaySamples:number;
  confidence:number;
  correlation:number;
}

export interface BenchmarkGainMatch {
  candidateGainDb:number;
  referenceRms:number;
  candidateRms:number;
}

export interface BenchmarkMetricDelta {
  metric:string;
  reference:number;
  candidate:number;
  delta:number;
}

export interface BlindBenchmarkPlan {
  benchmarkId:string;
  aliases:Record<string,string>;
  orderedLaneIds:string[];
  regionIds:string[];
  requiresTimeAlignment:true;
  requiresLoudnessMatch:true;
  requiresDeltaAudition:true;
  notes:string[];
}

const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const finite=(v:number|undefined):v is number=>typeof v==="number"&&Number.isFinite(v);

function overlap(
  reference:Float32Array,
  candidate:Float32Array,
  delay:number,
):{referenceStart:number;candidateStart:number;length:number}{
  const referenceStart=delay<0?-delay:0;
  const candidateStart=delay>0?delay:0;
  const length=Math.min(reference.length-referenceStart,candidate.length-candidateStart);
  return {referenceStart,candidateStart,length:Math.max(0,length)};
}

function correlationAt(reference:Float32Array,candidate:Float32Array,delay:number):number{
  const span=overlap(reference,candidate,delay);
  if(span.length<8)return 0;
  let xy=0,xx=0,yy=0;
  for(let i=0;i<span.length;i+=1){
    const a=reference[span.referenceStart+i]??0;
    const b=candidate[span.candidateStart+i]??0;
    xy+=a*b;xx+=a*a;yy+=b*b;
  }
  if(xx<=1e-18||yy<=1e-18)return 0;
  return xy/Math.sqrt(xx*yy);
}

/**
 * Positive candidateDelaySamples means the candidate content begins later than
 * the reference and must be shifted left by that many samples for comparison.
 */
export function estimateBenchmarkAlignment(
  reference:Float32Array,
  candidate:Float32Array,
  maxDelaySamples:number,
):BenchmarkAlignment{
  if(!Number.isInteger(maxDelaySamples)||maxDelaySamples<0)throw new Error("Maximum alignment delay must be a non-negative integer.");
  if(reference.length<8||candidate.length<8)throw new Error("Alignment requires non-empty audio evidence.");
  let bestDelay=0,best=-Infinity,second=-Infinity;
  for(let delay=-maxDelaySamples;delay<=maxDelaySamples;delay+=1){
    const score=correlationAt(reference,candidate,delay);
    if(score>best){second=best;best=score;bestDelay=delay;}
    else if(score>second)second=score;
  }
  const margin=best-second;
  return {
    candidateDelaySamples:bestDelay,
    correlation:Number.isFinite(best)?best:0,
    confidence:clamp(((best+1)/2)*0.8+Math.max(0,margin)*0.2,0,1),
  };
}

function rmsAt(samples:Float32Array,start:number,length:number):number{
  if(length<=0)return 0;
  let sum=0;
  for(let i=0;i<length;i+=1){const v=samples[start+i]??0;sum+=v*v;}
  return Math.sqrt(sum/length);
}

export function calculateBenchmarkLoudnessMatch(
  referenceIntegratedLufs:number,
  candidateIntegratedLufs:number,
  maximumGainDb=24,
):number{
  if(!Number.isFinite(referenceIntegratedLufs)||!Number.isFinite(candidateIntegratedLufs)){
    throw new Error("Integrated LUFS values are required for loudness matching.");
  }
  return clamp(referenceIntegratedLufs-candidateIntegratedLufs,-Math.abs(maximumGainDb),Math.abs(maximumGainDb));
}

export function calculateBenchmarkGainMatch(
  reference:Float32Array,
  candidate:Float32Array,
  candidateDelaySamples:number,
  maximumGainDb=24,
):BenchmarkGainMatch{
  const span=overlap(reference,candidate,candidateDelaySamples);
  if(span.length<8)throw new Error("Gain match requires aligned overlapping audio.");
  const referenceRms=rmsAt(reference,span.referenceStart,span.length);
  const candidateRms=rmsAt(candidate,span.candidateStart,span.length);
  const raw=candidateRms>1e-12&&referenceRms>1e-12?20*Math.log10(referenceRms/candidateRms):0;
  return {candidateGainDb:clamp(raw,-Math.abs(maximumGainDb),Math.abs(maximumGainDb)),referenceRms,candidateRms};
}

export function buildBenchmarkDeltaSignal(
  reference:Float32Array,
  candidate:Float32Array,
  candidateDelaySamples:number,
  candidateGainDb:number,
):Float32Array{
  const gain=10**(candidateGainDb/20);
  const output=new Float32Array(reference.length);
  for(let refIndex=0;refIndex<reference.length;refIndex+=1){
    const candidateIndex=refIndex+candidateDelaySamples;
    const adjusted=candidateIndex>=0&&candidateIndex<candidate.length?(candidate[candidateIndex]??0)*gain:0;
    output[refIndex]=adjusted-(reference[refIndex]??0);
  }
  return output;
}

function flattenMetrics(metrics:RestorationBenchmarkObjectiveMetrics):Record<string,number>{
  const output:Record<string,number>={};
  for(const [key,value] of Object.entries(metrics)){
    if(finite(value as number|undefined))output[key]=value as number;
    else if(value&&typeof value==="object"){
      for(const [band,bandValue] of Object.entries(value as Record<string,number>)){
        if(finite(bandValue))output[`${key}.${band}`]=bandValue;
      }
    }
  }
  return output;
}

/** Metric deltas are descriptive evidence only; this function never chooses a winner. */
export function compareBenchmarkMetrics(
  reference:RestorationBenchmarkMetricSnapshot,
  candidate:RestorationBenchmarkMetricSnapshot,
):BenchmarkMetricDelta[]{
  if(reference.benchmarkId!==candidate.benchmarkId||reference.regionId!==candidate.regionId){
    throw new Error("Objective benchmark snapshots must cover the same benchmark and region.");
  }
  const a=flattenMetrics(reference.metrics),b=flattenMetrics(candidate.metrics);
  return Object.keys(a).filter(key=>finite(b[key])).sort().map(metric=>({
    metric,reference:a[metric]!,candidate:b[metric]!,delta:b[metric]!-a[metric]!,
  }));
}

export function buildBlindBenchmarkPlan(input:RestorationBenchmarkCase):BlindBenchmarkPlan{
  const aliases=createBlindAliases(input.seed,input.lanes.map(lane=>lane.id));
  const orderedLaneIds=Object.entries(aliases).sort((a,b)=>a[1].localeCompare(b[1])).map(([laneId])=>laneId);
  return {
    benchmarkId:input.id,
    aliases,
    orderedLaneIds,
    regionIds:input.regions.map(region=>region.id),
    requiresTimeAlignment:true,
    requiresLoudnessMatch:true,
    requiresDeltaAudition:true,
    notes:[
      "Blind aliases conceal lane identity during listening.",
      "Objective metrics and subjective preference remain separate evidence streams.",
      "No single objective metric is permitted to declare a benchmark winner.",
    ],
  };
}
