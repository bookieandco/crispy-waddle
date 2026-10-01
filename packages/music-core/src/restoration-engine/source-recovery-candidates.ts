import type { RestorationCandidate, RestorationEvidence } from "./types.js";

export type MidSideRepairMode="mid"|"side";
export type MidSideInnerOperation="gain"|"eq"|"denoise"|"dehum";

const finite=(value:unknown):value is number=>typeof value==="number"&&Number.isFinite(value);

function evidenceOfKind(evidence:readonly RestorationEvidence[],kind:string):RestorationEvidence|undefined{
  return [...evidence].filter(item=>item.kind===kind).sort((a,b)=>b.confidence-a.confidence)[0];
}

export function buildSourceRecoveryCandidates(input:{
  sourceArtifactId:string;
  sampleRate:number;
  evidence:readonly RestorationEvidence[];
}):RestorationCandidate[]{
  if(!input.sourceArtifactId.trim())throw new Error("Source-recovery source artifact id is required.");
  if(!Number.isFinite(input.sampleRate)||input.sampleRate<=0)throw new Error("Source-recovery sample rate is invalid.");
  const candidates:RestorationCandidate[]=[];

  const band=evidenceOfKind(input.evidence,"music.source-recovery.band-limit");
  const cutoff=band?.data.cutoffHz;
  if(band?.data.detected===true&&band.confidence>=0.65&&finite(cutoff)){
    const nyquist=input.sampleRate/2;
    const extension=Math.min(nyquist,Math.max(cutoff+2000,cutoff*1.8));
    if(extension>cutoff){
      candidates.push({
        id:`source-recovery:${input.sourceArtifactId}:spectral-recovery`,
        operation:"spectral-recovery",
        operationClass:"source-recovery",
        status:"proposed",
        inputArtifactId:input.sourceArtifactId,
        parameters:{
          detectedCutoffHz:cutoff,
          maxExtensionHz:extension,
          strength:0.25,
          decayDbPerOctave:9,
          analysisConfidence:band.confidence,
        },
        evidenceIds:[band.id],
        provenance:"reconstructed",
      });
    }
  }

  const reverb=evidenceOfKind(input.evidence,"music.source-recovery.reverberation");
  if(reverb&&reverb.confidence>=0.65){
    candidates.push({
      id:`source-recovery:${input.sourceArtifactId}:dereverb`,
      operation:"dereverb",
      operationClass:"correction",
      status:"proposed",
      inputArtifactId:input.sourceArtifactId,
      parameters:{
        analysisConfidence:reverb.confidence,
        strength:0.30,
        maxReductionDb:6,
        decayMs:140,
      },
      evidenceIds:[reverb.id],
      provenance:"derived",
    });
  }

  return candidates;
}

export function createMidSideRepairCandidate(input:{
  id:string;
  sourceArtifactId:string;
  mode:MidSideRepairMode;
  innerOperation:MidSideInnerOperation;
  parameters?:Record<string,string|number|boolean>;
  evidenceIds:string[];
}):RestorationCandidate{
  if(!input.id.trim()||!input.sourceArtifactId.trim())throw new Error("Mid/Side candidate identity is required.");
  if(!input.evidenceIds.length)throw new Error("Mid/Side candidate requires evidence.");
  return {
    id:input.id,
    operation:"mid-side-repair",
    operationClass:"correction",
    status:"proposed",
    inputArtifactId:input.sourceArtifactId,
    parameters:{
      mode:input.mode,
      innerOperation:input.innerOperation,
      ...(input.parameters??{}),
    },
    evidenceIds:[...new Set(input.evidenceIds)],
    provenance:"derived",
  };
}
