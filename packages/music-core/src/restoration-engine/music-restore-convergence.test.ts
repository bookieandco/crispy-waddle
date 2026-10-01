import { describe, expect, it } from "vitest";
import {
  createBlindAliases,
  validateBenchmarkCase,
  type RestorationBenchmarkCase,
  type RestorationBenchmarkMetricSnapshot,
} from "./benchmark-contracts.js";
import {
  buildBenchmarkDeltaSignal,
  buildBlindBenchmarkPlan,
  calculateBenchmarkGainMatch,
  calculateBenchmarkLoudnessMatch,
  compareBenchmarkMetrics,
  estimateBenchmarkAlignment,
} from "./benchmark-harness.js";
import { classifyImpulseDamage, routeDeterministicRepair } from "./deterministic-repair-analysis.js";

const hash=(c:string)=>c.repeat(64);

function benchmark():RestorationBenchmarkCase{
  return {
    id:"MUSIC-RESTORE.AB-001",
    title:"No Good",
    sourceArtifactId:"source-1",
    sampleRate:48000,
    channels:2,
    seed:"no-good-seed",
    lanes:[
      {id:"source",role:"source",artifact:{artifactId:"source-1",sha256:hash("a"),mimeType:"audio/wav",sourceLabel:"source"},provenanceIds:["source:e1"]},
      {id:"jhadina",role:"jhadina-restoration",artifact:{artifactId:"candidate-1",sha256:hash("b"),mimeType:"audio/wav",sourceLabel:"candidate"},provenanceIds:["candidate:e1"]},
    ],
    regions:[{id:"whole",label:"Whole track",startSample:0,endSample:48000,evidenceIds:["region:e1"]}],
    blind:true,loudnessMatch:true,timeAlign:true,deltaAudition:true,noSingleMetricWinner:true,
    status:"defined",evidenceIds:["benchmark:e1"],
  };
}

describe("MUSIC-RESTORE-CONVERGENCE.1-.5",()=>{
  it("validates a hash-bound benchmark and creates stable blind aliases",()=>{
    const value=validateBenchmarkCase(benchmark());
    const one=createBlindAliases(value.seed,value.lanes.map(l=>l.id));
    const two=createBlindAliases(value.seed,value.lanes.map(l=>l.id));
    expect(one).toEqual(two);
    expect(one.source).not.toBe(one.jhadina);
    expect(buildBlindBenchmarkPlan(value).notes.join(" ")).toContain("No single objective metric");
  });

  it("aligns, gain matches and produces a near-zero delta for an equivalent delayed render",()=>{
    const reference=Float32Array.from([0.2,-0.7,0.4,0.9,-0.3,0.6,-0.8,0.1,0.5,-0.4,0.75,-0.2]);
    const candidate=new Float32Array(reference.length+2);
    reference.forEach((value,index)=>{candidate[index+2]=value*2;});
    const alignment=estimateBenchmarkAlignment(reference,candidate,4);
    expect(alignment.candidateDelaySamples).toBe(2);
    expect(alignment.correlation).toBeGreaterThan(0.99);
    expect(calculateBenchmarkLoudnessMatch(-14,-10)).toBe(-4);
    const gain=calculateBenchmarkGainMatch(reference,candidate,alignment.candidateDelaySamples);
    expect(gain.candidateGainDb).toBeCloseTo(-6.0206,3);
    const delta=buildBenchmarkDeltaSignal(reference,candidate,alignment.candidateDelaySamples,gain.candidateGainDb);
    expect(Math.max(...Array.from(delta).map(Math.abs))).toBeLessThan(1e-5);
  });

  it("keeps objective metric deltas descriptive instead of selecting a winner",()=>{
    const base:RestorationBenchmarkMetricSnapshot={
      benchmarkId:"b",laneId:"source",artifactId:"a",regionId:"whole",
      metrics:{integratedLufs:-12,truePeakDbtp:-1,bandLimitedCrestFactorDb:{"20-60":6}},
      evidenceIds:["m1"],measuredAt:"2026-10-01T00:00:00Z",
    };
    const candidate:RestorationBenchmarkMetricSnapshot={...base,laneId:"candidate",artifactId:"b",metrics:{integratedLufs:-14,truePeakDbtp:-1.2,bandLimitedCrestFactorDb:{"20-60":7}}};
    const changes=compareBenchmarkMetrics(base,candidate);
    expect(changes.find(x=>x.metric==="integratedLufs")?.delta).toBe(-2);
    expect(changes.some(x=>x.metric==="bandLimitedCrestFactorDb.20-60")).toBe(true);
    expect(changes.every(x=>!("winner" in x))).toBe(true);
  });

  it("routes discontinuities to spectral repair and analog impulse damage to declick",()=>{
    const discontinuity=classifyImpulseDamage({durationMs:4,spectralCentroidHz:5000,lowFrequencyEnergyRatio:0.2,eventCount:1,peakDerivativeRatio:30});
    expect(discontinuity.type).toBe("digital-discontinuity");
    expect(routeDeterministicRepair("click",discontinuity).operation).toBe("spectral-repair");

    const click=classifyImpulseDamage({durationMs:5,spectralCentroidHz:2200,lowFrequencyEnergyRatio:0.3,eventCount:1,peakDerivativeRatio:8});
    expect(click.type).toBe("click");
    expect(routeDeterministicRepair("click",click).operation).toBe("declick");
    expect(routeDeterministicRepair("hum").operation).toBe("dehum");
    expect(routeDeterministicRepair("hiss").operation).toBe("denoise");
    expect(routeDeterministicRepair("band-limited").operation).toBe("spectral-recovery");
    expect(routeDeterministicRepair("excess-reverb").operation).toBe("dereverb");
    expect(routeDeterministicRepair("stereo-imbalance").operation).toBe("mid-side-repair");
    expect(routeDeterministicRepair("wow").abstained).toBe(true);
    expect(routeDeterministicRepair("flutter").abstained).toBe(true);
    expect(routeDeterministicRepair("rumble").abstained).toBe(true);
  });
});
