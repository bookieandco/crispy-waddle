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


function correlationAt(reference:Float32Array,candidate:Float32Array,delay:number):number|null{
  const span=overlap(reference,candidate,delay);
  const minOverlap=Math.max(8,Math.ceil(Math.min(reference.length,candidate.length)*0.5));
  if(span.length<minOverlap)return null;
  // Bound computation on full songs without changing the candidate sample clock.
  const stride=Math.max(1,Math.floor(span.length/16384));
  let n=0,sumA=0,sumB=0,sumAA=0,sumBB=0,sumAB=0;
  for(let i=0;i<span.length;i+=stride){
    const a=reference[span.referenceStart+i]!;
    const b=candidate[span.candidateStart+i]!;
    n++;sumA+=a;sumB+=b;sumAA+=a*a;sumBB+=b*b;sumAB+=a*b;
  }
  const varA=sumAA-sumA*sumA/n,varB=sumBB-sumB*sumB/n;
  if(varA<=1e-12*n||varB<=1e-12*n)return null;
  return clamp((sumAB-sumA*sumB/n)/Math.sqrt(varA*varB),-1,1);
}

/**
 * A/B alignment is evidence, not permission to move audio. DC, silence,
 * non-finite input, repeated/periodic peaks and weak correlations abstain.
 * This preserves the old return shape: confidence=0 and delay=0 mean no
 * measurement can support an automatic alignment.
 */
export function estimateBenchmarkAlignment(
  reference:Float32Array,
  candidate:Float32Array,
  maxDelaySamples:number,
):BenchmarkAlignment{
  if(!Number.isInteger(maxDelaySamples)||maxDelaySamples<0)throw new Error("Maximum alignment delay must be a non-negative integer.");
  if(reference.length<8||candidate.length<8)throw new Error("Alignment requires non-empty audio evidence.");
  for(const samples of [reference,candidate]){
    for(const sample of samples)if(!Number.isFinite(sample))
      return {candidateDelaySamples:0,correlation:0,confidence:0};
  }
  // Evaluate a coarse lag grid first when the possible delay is wide.
  const coarseStep=Math.max(1,Math.ceil(maxDelaySamples/512));
  const scored=new Map<number,number>();
  const score=(lag:number)=>{
    if(scored.has(lag))return scored.get(lag)!;
    const value=correlationAt(reference,candidate,lag);
    if(value!==null)scored.set(lag,value);
    return value;
  };
  const candidates=new Set<number>([0,-maxDelaySamples,maxDelaySamples]);
  for(let lag=-maxDelaySamples;lag<=maxDelaySamples;lag+=coarseStep)candidates.add(lag);
  let coarseLag=0,coarseScore=-Infinity;
  for(const lag of candidates){
    const s=score(lag);
    if(s!==null&&s>coarseScore){coarseScore=s;coarseLag=lag;}
  }
  if(!Number.isFinite(coarseScore)||coarseScore<0.35)
    return {candidateDelaySamples:0,correlation:0,confidence:0};
  for(let lag=Math.max(-maxDelaySamples,coarseLag-coarseStep);
      lag<=Math.min(maxDelaySamples,coarseLag+coarseStep);lag++)score(lag);
  const ordered=[...scored].sort((a,b)=>b[1]-a[1]);
  const [bestLag,best]=ordered[0]!;
  // An adjacent lag can be highly correlated on band-limited audio; compare
  // distinctive peaks at least two samples apart, not a neighboring shoulder.
  const rival=ordered.find(([lag])=>Math.abs(lag-bestLag)>1)?.[1]??-1;
  const margin=best-rival;
  if(best<0.5||margin<0.015)
    return {candidateDelaySamples:0,correlation:best,confidence:0};
  return {candidateDelaySamples:bestLag,correlation:best,
    confidence:clamp(best*Math.min(1,margin/0.15),0,1)};
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
