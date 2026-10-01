import { describe, expect, it } from "vitest";
import { analyzeRestorationSourceRecovery } from "./source-recovery-runtime.js";
import type { RestorationArtifactStore, StoredRestorationArtifact } from "./ingest-runtime.js";
import type { RestorationRuntimeClient, RestorationSourceRecoveryAnalysisReceipt } from "./runtime-contract.js";

const artifact:StoredRestorationArtifact={
  id:"source-1",
  kind:"source",
  contentHash:"a".repeat(64),
  sampleRate:48000,
  channels:2,
  sampleCount:96000,
  createdAt:"2026-10-01T00:00:00.000Z",
  ownerUserId:"user-1",
  caseId:"case-1",
  storageUri:"memory://source-1",
  mimeType:"audio/wav",
  sizeBytes:100,
};

const receipt:RestorationSourceRecoveryAnalysisReceipt={
  sourceArtifactId:"source-1",
  sourceSha256:"a".repeat(64),
  sampleRate:48000,
  channels:2,
  sampleCount:96000,
  durationSeconds:2,
  analysisWindowSeconds:2,
  bandLimit:{detected:true,cutoffHz:8000,confidence:0.84,edgeDropDb:27,highBandEnergyRatio:0.002},
  reverberation:{
    tailPersistence:0.46,
    excessReverbConfidence:0.72,
    echoDelayMs:118,
    echoConfidence:0.66,
    sustainConfoundPossible:true,
  },
  analogTransfer:{
    humClass:"drifting",
    humReferenceHz:59.9,
    humConfidence:0.82,
    humDriftStdHz:0.2,
    humDriftRangeHz:0.8,
    programToneReferenceHz:440,
    programToneConfidence:0.78,
    relativeDriftCorrelation:0.86,
    wowModulationEnergyRatio:0.7,
    flutterModulationEnergyRatio:0.15,
    timebaseConfidence:0.6,
    wowConfidence:0.63,
    flutterConfidence:0.14,
    corroborated:true,
    timebaseCorrectionEligible:true,
    rumbleRatio:0.2,
    rumbleConfidence:0.3,
    hissHighBandRatio:0.04,
    hissSpectralFlatness:0.7,
    hissConfidence:0.55,
    channelDelayMs:0.3,
    channelDelayConfidence:0.8,
    azimuthRisk:0.2,
  },
  spatial:{stereoCorrelation:0.72,sideToMidEnergyRatio:0.31},
  notes:["evidence only"],
  providerId:"jhadina-source-recovery-deterministic",
  providerVersion:"1.0.0",
  runtimeReceiptId:"music-source-recovery-analysis:receipt",
};

describe("source recovery analysis runtime",()=>{
  it("binds the receipt to the artifact and emits independent evidence streams",async()=>{
    const store={
      async resolveRuntimeUri(){ return "https://runtime.test/source-1"; },
    } as unknown as RestorationArtifactStore;
    const runtime={
      async analyzeSourceRecovery(){ return receipt; },
    } as unknown as RestorationRuntimeClient;

    const result=await analyzeRestorationSourceRecovery({
      ownerUserId:"user-1",
      artifact,
      store,
      runtime,
    });

    expect(result.receipt.bandLimit.detected).toBe(true);
    expect(result.evidence.find(item=>item.kind==="music.source-recovery.band-limit")?.data.cutoffHz).toBe(8000);
    expect(result.evidence.find(item=>item.kind==="music.analog-transfer.timebase")?.data.timebaseCorrectionEligible).toBe(true);
    expect(result.evidence.find(item=>item.kind==="music.source-recovery.reverberation")?.data.sustainConfoundPossible).toBe(true);
    expect(result.evidence).toHaveLength(9);
  });

  it("fails closed when the runtime source-recovery analyzer is absent",async()=>{
    const store={
      async resolveRuntimeUri(){ return "https://runtime.test/source-1"; },
    } as unknown as RestorationArtifactStore;
    const runtime={} as RestorationRuntimeClient;
    await expect(analyzeRestorationSourceRecovery({
      ownerUserId:"user-1",
      artifact,
      store,
      runtime,
    })).rejects.toThrow("unavailable");
  });
});
