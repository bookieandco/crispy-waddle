import { describe, expect, it } from "vitest";
import {
  analyzeMixTranslationQc,
  analyzeStemIntegritySweep,
  analyzeVocalIntelligence,
  tonalBalanceDistance,
  type TonalBalanceEnvelope,
} from "./convergence-qc-runtime.js";
import type { RestorationArtifactStore, StoredRestorationArtifact } from "./ingest-runtime.js";
import type {
  RestorationMixTranslationReceipt,
  RestorationRuntimeClient,
  RestorationStemIntegrityReceipt,
  RestorationVocalIntelligenceReceipt,
} from "./runtime-contract.js";

const source:StoredRestorationArtifact={
  id:"source-1",kind:"source",contentHash:"a".repeat(64),sampleRate:48000,channels:2,sampleCount:96000,
  createdAt:"2026-10-01T00:00:00.000Z",ownerUserId:"user-1",caseId:"case-1",
  storageUri:"memory://source",mimeType:"audio/wav",sizeBytes:100,
};
const stem=(id:string,role:"vocals"|"drums"|"bass"|"other"):StoredRestorationArtifact=>({
  ...source,id,kind:"derived",contentHash:id.slice(-1).repeat(64),parentArtifactId:source.id,
  storageUri:`memory://${id}`,role,
});
const vocals=stem("stem-v","vocals");
const drums=stem("stem-d","drums");
const bass=stem("stem-b","bass");
const other=stem("stem-o","other");

const store={
  async resolveRuntimeUri(_owner:string,artifactId:string){return `https://runtime.test/${artifactId}`;},
} as unknown as RestorationArtifactStore;

describe("MUSIC-RESTORE-CONVERGENCE.6-.8",()=>{
  it("sweeps stem sensitivity while conserving all attribution energy",async()=>{
    const runtime={
      async analyzeStemIntegrity(input:{sensitivity?:number}):Promise<RestorationStemIntegrityReceipt>{
        const sensitivity=input.sensitivity??0.5;
        return {
          sourceArtifactId:source.id,sourceSha256:source.contentHash,
          stemArtifactIds:{vocals:vocals.id,drums:drums.id,bass:bass.id,other:other.id},
          sampleRate:48000,channels:2,sampleCount:96000,sensitivity,
          recombinationErrorRatio:0.01,nullResidualDb:-40,
          attributionShares:{vocals:0.3,drums:0.3,bass:0.2,other:0.2},
          ambiguousEnergyRatio:0.1+sensitivity*0.1,attributionConfidence:0.82,
          leakageMatrix:{vocals:{vocals:0,drums:0.05,bass:0.02,other:0.08}},
          worstPairwiseLeakage:0.08,energyAccountingConserved:true,recombinedRenderMeasured:true,
          notes:["evidence only"],providerId:"jhadina-convergence-qc",providerVersion:"1.0.0",
          runtimeReceiptId:`stem-receipt-${sensitivity}`,
        };
      },
    } as unknown as RestorationRuntimeClient;
    const result=await analyzeStemIntegritySweep({
      ownerUserId:"user-1",caseId:"case-1",source,stems:[vocals,drums,bass,other],runtime,store,
    });
    expect(result.receipts.map(item=>item.sensitivity)).toEqual([0.25,0.5,0.75]);
    expect(result.receipts.every(item=>Object.values(item.attributionShares).reduce((a,b)=>a+b,0)===1)).toBe(true);
    expect(result.benchmarkMetrics.stemRecombinationError).toBe(0.01);
    expect(result.benchmarkMetrics.stemLeakage).toBe(0.08);
  });

  it("keeps external vocal references descriptive and identity subordinate",async()=>{
    const reference:StoredRestorationArtifact={...vocals,id:"reference-v",contentHash:"e".repeat(64),caseId:"reference-case"};
    const profile={
      sampleRate:48000,durationSeconds:2,medianF0Hz:220,f0SpreadCents:180,voicedFraction:0.74,
      spectralCentroidHz:2400,rmsDb:-18,harmonicity:0.32,harmonicFollowConfidence:0.64,
      breathFrameRatio:0.08,sibilanceFrameRatio:0.05,mouthEventFrameRatio:0.01,
      phraseLevelMap:[{index:0,startMs:0,endMs:500,rmsDb:-18,relativeGainDb:0}],
    };
    const runtime={
      async analyzeVocalIntelligence():Promise<RestorationVocalIntelligenceReceipt>{
        return {
          sourceArtifactId:vocals.id,sourceSha256:vocals.contentHash,referenceArtifactId:reference.id,
          referenceRelation:"external-style",sourceProfile:profile,referenceProfile:{...profile,medianF0Hz:230},
          referenceDistance:0.12,externalReferenceCannotOverrideIdentity:true,notes:["preservation cue"],
          providerId:"jhadina-convergence-qc",providerVersion:"1.0.0",runtimeReceiptId:"vocal-receipt-1",
        };
      },
    } as unknown as RestorationRuntimeClient;
    const result=await analyzeVocalIntelligence({
      ownerUserId:"user-1",caseId:"case-1",vocal:vocals,reference,referenceRelation:"external-style",runtime,store,
    });
    expect(result.receipt.externalReferenceCannotOverrideIdentity).toBe(true);
    expect(result.evidence.find(item=>item.kind==="music.vocal-non-tonal-events")?.data.preservationCue).toBe(true);
    expect(result.evidence.find(item=>item.kind==="music.vocal-phrase-level")?.data.phraseCount).toBe(1);
  });

  it("maps tonal balance, masking, band crest and translation simulations into benchmark metrics",async()=>{
    const receipt:RestorationMixTranslationReceipt={
      sourceArtifactId:source.id,sourceSha256:source.contentHash,sampleRate:48000,channels:2,sampleCount:96000,
      tonalBalance:{"20-60":0.05,"60-120":0.1,"120-250":0.15,"250-500":0.15,"500-2000":0.25,"2000-4000":0.12,"4000-8000":0.1,"8000-16000":0.08},
      bandCrestFactorDb:{"20-60":7,"60-120":8,"120-250":9,full:11},
      maskingGraph:{edges:[{target:"vocals",masker:"other",score:0.2}],cumulative:{vocals:0.2,drums:0.1}},
      translations:{
        mono:{correlation:0.98,rmsDeltaDb:-0.2,spectralCentroidRelativeDelta:0.02,failureScore:0.04},
        phone:{correlation:0.72,rmsDeltaDb:-2,spectralCentroidRelativeDelta:0.45,failureScore:0.42},
        "small-speaker":{correlation:0.86,rmsDeltaDb:-1,spectralCentroidRelativeDelta:0.2,failureScore:0.2},
        lossy:{correlation:0.99,rmsDeltaDb:-0.1,spectralCentroidRelativeDelta:0.01,failureScore:0.02},
        "streaming-normalized":{correlation:0.97,rmsDeltaDb:-1,spectralCentroidRelativeDelta:0.03,failureScore:0.08},
      },
      translationFailureCount:0,notes:["ephemeral"],providerId:"jhadina-convergence-qc",providerVersion:"1.0.0",
      runtimeReceiptId:"mix-receipt-1",
    };
    const runtime={async analyzeMixTranslation(){return receipt;}} as unknown as RestorationRuntimeClient;
    const envelope:TonalBalanceEnvelope={
      id:"reference-1",label:"Reference envelope",
      bands:{"20-60":{minimum:0.03,maximum:0.08},"60-120":{minimum:0.07,maximum:0.13}},
    };
    const result=await analyzeMixTranslationQc({
      ownerUserId:"user-1",caseId:"case-1",source,stems:[vocals,drums,bass,other],runtime,store,tonalEnvelope:envelope,
    });
    expect(result.benchmarkMetrics.fullRangeCrestFactorDb).toBe(11);
    expect(result.benchmarkMetrics.bandLimitedCrestFactorDb?.["20-60"]).toBe(7);
    expect(result.benchmarkMetrics.maskingScore).toBeCloseTo(0.15);
    expect(result.benchmarkMetrics.translationFailureCount).toBe(0);
    expect(result.benchmarkMetrics.tonalBalanceDistance).toBe(0);
  });

  it("scores only out-of-envelope tonal energy as distance",()=>{
    const envelope:TonalBalanceEnvelope={id:"e",label:"e",bands:{"20-60":{minimum:0.1,maximum:0.2}}};
    expect(tonalBalanceDistance({"20-60":0.15},envelope)).toBe(0);
    expect(tonalBalanceDistance({"20-60":0.3},envelope)).toBeCloseTo(1);
  });
});
