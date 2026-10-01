import { describe, expect, it } from "vitest";
import { buildSourceRecoveryCandidates, createMidSideRepairCandidate } from "./source-recovery-candidates.js";
import type { RestorationEvidence } from "./types.js";

const evidence:RestorationEvidence[]=[
  {
    id:"band-1",kind:"music.source-recovery.band-limit",confidence:0.84,sourceArtifactId:"source-1",
    data:{detected:true,cutoffHz:8000,edgeDropDb:25,highBandEnergyRatio:0.002},
  },
  {
    id:"reverb-1",kind:"music.source-recovery.reverberation",confidence:0.72,sourceArtifactId:"source-1",
    data:{tailPersistence:0.45,excessReverbConfidence:0.72,sustainConfoundPossible:true},
  },
];

describe("source recovery candidate compiler",()=>{
  it("labels spectral recovery as reconstructed source-recovery",()=>{
    const candidates=buildSourceRecoveryCandidates({sourceArtifactId:"source-1",sampleRate:48000,evidence});
    const spectral=candidates.find(candidate=>candidate.operation==="spectral-recovery");
    expect(spectral?.operationClass).toBe("source-recovery");
    expect(spectral?.provenance).toBe("reconstructed");
    expect(spectral?.parameters.detectedCutoffHz).toBe(8000);
    expect(spectral?.evidenceIds).toEqual(["band-1"]);
  });

  it("creates a conservative dereverb correction only with adequate evidence",()=>{
    const candidates=buildSourceRecoveryCandidates({sourceArtifactId:"source-1",sampleRate:48000,evidence});
    const dereverb=candidates.find(candidate=>candidate.operation==="dereverb");
    expect(dereverb?.operationClass).toBe("correction");
    expect(dereverb?.provenance).toBe("derived");
    expect(dereverb?.parameters.strength).toBe(0.3);
  });

  it("requires evidence for explicit Mid/Side repair candidates",()=>{
    expect(()=>createMidSideRepairCandidate({
      id:"ms-1",sourceArtifactId:"source-1",mode:"side",innerOperation:"denoise",evidenceIds:[],
    })).toThrow("requires evidence");
    const candidate=createMidSideRepairCandidate({
      id:"ms-1",sourceArtifactId:"source-1",mode:"side",innerOperation:"denoise",
      parameters:{innerNoiseFloorDb:-55,innerNoiseReductionDb:8},evidenceIds:["spatial-1"],
    });
    expect(candidate.parameters.mode).toBe("side");
    expect(candidate.operation).toBe("mid-side-repair");
  });
});
