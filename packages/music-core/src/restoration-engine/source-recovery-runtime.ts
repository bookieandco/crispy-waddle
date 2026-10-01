import type { RestorationEvidence } from "./types.js";
import type { RestorationArtifactStore, StoredRestorationArtifact } from "./ingest-runtime.js";
import type {
  RestorationRuntimeClient,
  RestorationRuntimeSource,
  RestorationSourceRecoveryAnalysisReceipt,
} from "./runtime-contract.js";

export interface RestorationSourceRecoveryAnalysisResult {
  receipt: RestorationSourceRecoveryAnalysisReceipt;
  evidence: RestorationEvidence[];
}

const clamp01=(value:number):number=>Math.max(0,Math.min(1,value));

function evidence(
  artifact:StoredRestorationArtifact,
  suffix:string,
  kind:string,
  confidence:number,
  data:RestorationEvidence["data"],
):RestorationEvidence{
  return {
    id:`source-recovery:${artifact.id}:${suffix}`,
    kind,
    confidence:clamp01(confidence),
    sourceArtifactId:artifact.id,
    region:{startSample:0,endSample:artifact.sampleCount},
    data,
  };
}

/**
 * CONVERGENCE.4-.5 analysis boundary.
 *
 * This converts one hash-bound worker receipt into descriptive evidence. It
 * never creates a repair candidate, never authorizes execution, and explicitly
 * keeps timebase correction gated on corroborated hum + program-tone drift.
 */
export async function analyzeRestorationSourceRecovery(input:{
  ownerUserId:string;
  artifact:StoredRestorationArtifact;
  store:RestorationArtifactStore;
  runtime:RestorationRuntimeClient;
}):Promise<RestorationSourceRecoveryAnalysisResult>{
  if(input.artifact.ownerUserId!==input.ownerUserId){
    throw new Error("Source-recovery artifact ownership mismatch.");
  }
  if(!input.runtime.analyzeSourceRecovery){
    throw new Error("Source-recovery analysis runtime is unavailable.");
  }
  const uri=await input.store.resolveRuntimeUri(input.ownerUserId,input.artifact.id);
  const source:RestorationRuntimeSource={
    artifactId:input.artifact.id,
    uri,
    sha256:input.artifact.contentHash,
    mimeType:input.artifact.mimeType,
  };
  const receipt=await input.runtime.analyzeSourceRecovery({source});
  if(receipt.sourceArtifactId!==input.artifact.id||receipt.sourceSha256.toLowerCase()!==input.artifact.contentHash.toLowerCase()){
    throw new Error("Source-recovery analysis lineage mismatch.");
  }
  if(receipt.sampleRate!==input.artifact.sampleRate||receipt.channels!==input.artifact.channels||receipt.sampleCount!==input.artifact.sampleCount){
    throw new Error("Source-recovery analysis signal dimensions changed.");
  }

  const items:RestorationEvidence[]=[];
  items.push(evidence(input.artifact,"band-limit","music.source-recovery.band-limit",receipt.bandLimit.confidence,{
    detected:receipt.bandLimit.detected,
    cutoffHz:receipt.bandLimit.cutoffHz??null,
    edgeDropDb:receipt.bandLimit.edgeDropDb,
    highBandEnergyRatio:receipt.bandLimit.highBandEnergyRatio,
  }));
  items.push(evidence(input.artifact,"reverb","music.source-recovery.reverberation",receipt.reverberation.excessReverbConfidence,{
    tailPersistence:receipt.reverberation.tailPersistence,
    excessReverbConfidence:receipt.reverberation.excessReverbConfidence,
    sustainConfoundPossible:receipt.reverberation.sustainConfoundPossible,
  }));
  items.push(evidence(input.artifact,"echo","music.source-recovery.echo",receipt.reverberation.echoConfidence,{
    echoDelayMs:receipt.reverberation.echoDelayMs??null,
    echoConfidence:receipt.reverberation.echoConfidence,
  }));
  items.push(evidence(input.artifact,"hum-ridge","music.analog-transfer.hum-ridge",receipt.analogTransfer.humConfidence,{
    humClass:receipt.analogTransfer.humClass,
    humReferenceHz:receipt.analogTransfer.humReferenceHz??null,
    humDriftStdHz:receipt.analogTransfer.humDriftStdHz,
    humDriftRangeHz:receipt.analogTransfer.humDriftRangeHz,
  }));
  items.push(evidence(input.artifact,"timebase","music.analog-transfer.timebase",receipt.analogTransfer.timebaseConfidence,{
    programToneReferenceHz:receipt.analogTransfer.programToneReferenceHz??null,
    programToneConfidence:receipt.analogTransfer.programToneConfidence,
    relativeDriftCorrelation:receipt.analogTransfer.relativeDriftCorrelation,
    wowConfidence:receipt.analogTransfer.wowConfidence,
    flutterConfidence:receipt.analogTransfer.flutterConfidence,
    corroborated:receipt.analogTransfer.corroborated,
    timebaseCorrectionEligible:receipt.analogTransfer.timebaseCorrectionEligible,
  }));
  items.push(evidence(input.artifact,"rumble","music.analog-transfer.rumble",receipt.analogTransfer.rumbleConfidence,{
    rumbleRatio:receipt.analogTransfer.rumbleRatio,
  }));
  items.push(evidence(input.artifact,"hiss","music.analog-transfer.hiss",receipt.analogTransfer.hissConfidence,{
    hissHighBandRatio:receipt.analogTransfer.hissHighBandRatio,
    hissSpectralFlatness:receipt.analogTransfer.hissSpectralFlatness,
  }));
  items.push(evidence(input.artifact,"azimuth","music.analog-transfer.azimuth",receipt.analogTransfer.channelDelayConfidence,{
    channelDelayMs:receipt.analogTransfer.channelDelayMs??null,
    channelDelayConfidence:receipt.analogTransfer.channelDelayConfidence,
    azimuthRisk:receipt.analogTransfer.azimuthRisk,
  }));
  items.push(evidence(input.artifact,"mid-side","music.spatial.mid-side",receipt.spatial.stereoCorrelation==null?0.25:0.75,{
    stereoCorrelation:receipt.spatial.stereoCorrelation??null,
    sideToMidEnergyRatio:receipt.spatial.sideToMidEnergyRatio??null,
  }));
  return {receipt,evidence:items};
}
