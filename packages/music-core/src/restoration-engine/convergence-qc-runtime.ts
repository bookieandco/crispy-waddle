import type { RestorationEvidence } from "./types.js";
import type { RestorationArtifactStore, StoredRestorationArtifact } from "./ingest-runtime.js";
import type {
  RestorationMixTranslationReceipt,
  RestorationQcStemSource,
  RestorationRuntimeClient,
  RestorationRuntimeSource,
  RestorationStemIntegrityReceipt,
  RestorationVocalIntelligenceReceipt,
} from "./runtime-contract.js";
import type { RestorationBenchmarkObjectiveMetrics } from "./benchmark-contracts.js";

function runtimeSource(uri:string,artifact:StoredRestorationArtifact):RestorationRuntimeSource{
  return {artifactId:artifact.id,uri,sha256:artifact.contentHash,mimeType:artifact.mimeType};
}

function assertOwner(artifact:StoredRestorationArtifact,ownerUserId:string,label:string):void{
  if(artifact.ownerUserId!==ownerUserId)throw new Error(`${label} ownership mismatch.`);
}

function assertCase(artifact:StoredRestorationArtifact,caseId:string,label:string):void{
  if(artifact.caseId!==caseId)throw new Error(`${label} case mismatch.`);
}

function evidence(
  id:string,
  kind:string,
  sourceArtifactId:string,
  confidence:number,
  data:RestorationEvidence["data"],
):RestorationEvidence{
  return {
    id,kind,sourceArtifactId,confidence:Math.max(0,Math.min(1,confidence)),data,
  };
}

async function toRuntimeStem(
  store:RestorationArtifactStore,
  ownerUserId:string,
  artifact:StoredRestorationArtifact,
):Promise<RestorationQcStemSource>{
  const role=artifact.role;
  if(role!=="vocals"&&role!=="drums"&&role!=="bass"&&role!=="other"&&role!=="unknown"){
    throw new Error(`Unsupported restoration stem role: ${String(role)}`);
  }
  return {
    role,
    source:runtimeSource(await store.resolveRuntimeUri(ownerUserId,artifact.id),artifact),
  };
}

export interface StemIntegritySweepResult{
  receipts:RestorationStemIntegrityReceipt[];
  evidence:RestorationEvidence[];
  benchmarkMetrics:RestorationBenchmarkObjectiveMetrics;
}

export async function analyzeStemIntegritySweep(input:{
  ownerUserId:string;
  caseId:string;
  source:StoredRestorationArtifact;
  stems:StoredRestorationArtifact[];
  runtime:RestorationRuntimeClient;
  store:RestorationArtifactStore;
  sensitivities?:number[];
}):Promise<StemIntegritySweepResult>{
  assertOwner(input.source,input.ownerUserId,"Stem-integrity source");
  assertCase(input.source,input.caseId,"Stem-integrity source");
  if(input.stems.length<2)throw new Error("Stem-integrity sweep requires at least two stems.");
  if(!input.runtime.analyzeStemIntegrity)throw new Error("Stem-integrity runtime is unavailable.");

  for(const stem of input.stems){
    assertOwner(stem,input.ownerUserId,"Stem");
    assertCase(stem,input.caseId,"Stem");
    if(stem.parentArtifactId!==input.source.id)throw new Error("Stem-integrity lineage mismatch.");
  }
  const sensitivities=[...new Set(input.sensitivities??[0.25,0.5,0.75])].sort((a,b)=>a-b);
  if(!sensitivities.length||sensitivities.some(value=>!Number.isFinite(value)||value<0||value>1)){
    throw new Error("Stem-integrity sensitivities must be finite values from 0 to 1.");
  }
  const source=runtimeSource(await input.store.resolveRuntimeUri(input.ownerUserId,input.source.id),input.source);
  const stems=await Promise.all(input.stems.map(stem=>toRuntimeStem(input.store,input.ownerUserId,stem)));
  const receipts:RestorationStemIntegrityReceipt[]=[];
  const items:RestorationEvidence[]=[];
  for(const sensitivity of sensitivities){
    const receipt=await input.runtime.analyzeStemIntegrity({source,stems,sensitivity});
    if(receipt.sampleRate!==input.source.sampleRate||receipt.channels!==input.source.channels||
       receipt.sampleCount!==input.source.sampleCount){
      throw new Error("Stem-integrity analysis changed signal geometry.");
    }
    const shareTotal=Object.values(receipt.attributionShares).reduce((sum,value)=>sum+value,0);
    if(!receipt.energyAccountingConserved||Math.abs(shareTotal-1)>1e-5||!receipt.recombinedRenderMeasured){
      throw new Error("Stem-integrity analysis failed energy/recombination accounting.");
    }
    receipts.push(receipt);
    items.push(evidence(
      `stem-integrity:${receipt.runtimeReceiptId}:${sensitivity}`,
      "music.stem-integrity",
      input.source.id,
      receipt.attributionConfidence,
      {
        sensitivity,
        recombinationErrorRatio:receipt.recombinationErrorRatio,
        nullResidualDb:receipt.nullResidualDb,
        ambiguousEnergyRatio:receipt.ambiguousEnergyRatio,
        attributionConfidence:receipt.attributionConfidence,
        worstPairwiseLeakage:receipt.worstPairwiseLeakage,
        attributionSharesJson:JSON.stringify(receipt.attributionShares),
        leakageMatrixJson:JSON.stringify(receipt.leakageMatrix),
        runtimeReceiptId:receipt.runtimeReceiptId,
      },
    ));
  }
  const median=receipts[Math.floor(receipts.length/2)]!;
  return {
    receipts,
    evidence:items,
    benchmarkMetrics:{
      stemLeakage:median.worstPairwiseLeakage,
      stemRecombinationError:median.recombinationErrorRatio,
    },
  };
}

export interface VocalIntelligenceAnalysisResult{
  receipt:RestorationVocalIntelligenceReceipt;
  evidence:RestorationEvidence[];
}

export async function analyzeVocalIntelligence(input:{
  ownerUserId:string;
  caseId:string;
  vocal:StoredRestorationArtifact;
  reference?:StoredRestorationArtifact;
  referenceRelation?:
    |"same-source"|"same-phrase"|"same-song"|"same-session"|"known-clean"|"external-style";
  runtime:RestorationRuntimeClient;
  store:RestorationArtifactStore;
}):Promise<VocalIntelligenceAnalysisResult>{
  assertOwner(input.vocal,input.ownerUserId,"Vocal");
  assertCase(input.vocal,input.caseId,"Vocal");
  if(input.vocal.role!=="vocals"&&!input.vocal.role?.startsWith("vocal-")){
    throw new Error("Vocal-intelligence analysis requires a vocal artifact.");
  }
  if(!input.runtime.analyzeVocalIntelligence)throw new Error("Vocal-intelligence runtime is unavailable.");
  if(input.reference)assertOwner(input.reference,input.ownerUserId,"Vocal reference");

  const vocal=runtimeSource(await input.store.resolveRuntimeUri(input.ownerUserId,input.vocal.id),input.vocal);
  const reference=input.reference
    ? runtimeSource(await input.store.resolveRuntimeUri(input.ownerUserId,input.reference.id),input.reference)
    : undefined;
  const relation=input.referenceRelation??"same-source";
  const receipt=await input.runtime.analyzeVocalIntelligence({vocal,reference,referenceRelation:relation});
  if(receipt.referenceRelation!==relation)throw new Error("Vocal reference relation changed in runtime.");
  if(relation==="external-style"&&!receipt.externalReferenceCannotOverrideIdentity){
    throw new Error("External vocal reference was permitted to override identity.");
  }
  const profile=receipt.sourceProfile;
  const items=[
    evidence(`vocal-profile:${receipt.runtimeReceiptId}`,"music.vocal-reference-profile",input.vocal.id,0.8,{
      referenceRelation:receipt.referenceRelation,
      referenceDistance:receipt.referenceDistance??null,
      voicedFraction:profile.voicedFraction,
      medianF0Hz:profile.medianF0Hz??null,
      f0SpreadCents:profile.f0SpreadCents??null,
      spectralCentroidHz:profile.spectralCentroidHz,
      harmonicity:profile.harmonicity,
      harmonicFollowConfidence:profile.harmonicFollowConfidence,
      runtimeReceiptId:receipt.runtimeReceiptId,
    }),
    evidence(`vocal-level:${receipt.runtimeReceiptId}`,"music.vocal-phrase-level",input.vocal.id,0.75,{
      phraseLevelMapJson:JSON.stringify(profile.phraseLevelMap),
      phraseCount:profile.phraseLevelMap.length,
      runtimeReceiptId:receipt.runtimeReceiptId,
    }),
    evidence(`vocal-events:${receipt.runtimeReceiptId}`,"music.vocal-non-tonal-events",input.vocal.id,0.7,{
      breathFrameRatio:profile.breathFrameRatio,
      sibilanceFrameRatio:profile.sibilanceFrameRatio,
      mouthEventFrameRatio:profile.mouthEventFrameRatio,
      preservationCue:true,
      runtimeReceiptId:receipt.runtimeReceiptId,
    }),
  ];
  return {receipt,evidence:items};
}

export interface TonalBalanceEnvelope{
  id:string;
  label:string;
  bands:Record<string,{minimum:number;maximum:number}>;
}

export function tonalBalanceDistance(
  measured:Record<string,number>,
  envelope:TonalBalanceEnvelope,
):number{
  const keys=Object.keys(envelope.bands);
  if(!keys.length)throw new Error("Tonal-balance envelope requires at least one band.");
  let distance=0;
  for(const key of keys){
    const bounds=envelope.bands[key]!;
    const value=measured[key];
    if(value===undefined||!Number.isFinite(value)||bounds.minimum<0||bounds.maximum>1||bounds.maximum<bounds.minimum){
      throw new Error(`Invalid tonal-balance band: ${key}`);
    }
    const width=Math.max(0.01,bounds.maximum-bounds.minimum);
    if(value<bounds.minimum)distance+=(bounds.minimum-value)/width;
    else if(value>bounds.maximum)distance+=(value-bounds.maximum)/width;
  }
  return Math.max(0,Math.min(1,distance/keys.length));
}

export interface MixTranslationAnalysisResult{
  receipt:RestorationMixTranslationReceipt;
  evidence:RestorationEvidence[];
  benchmarkMetrics:RestorationBenchmarkObjectiveMetrics;
}

export async function analyzeMixTranslationQc(input:{
  ownerUserId:string;
  caseId:string;
  source:StoredRestorationArtifact;
  stems?:StoredRestorationArtifact[];
  runtime:RestorationRuntimeClient;
  store:RestorationArtifactStore;
  tonalEnvelope?:TonalBalanceEnvelope;
}):Promise<MixTranslationAnalysisResult>{
  assertOwner(input.source,input.ownerUserId,"Translation source");
  assertCase(input.source,input.caseId,"Translation source");
  if(!input.runtime.analyzeMixTranslation)throw new Error("Mix-translation runtime is unavailable.");
  const source=runtimeSource(await input.store.resolveRuntimeUri(input.ownerUserId,input.source.id),input.source);
  const stems:RestorationQcStemSource[]=[];
  for(const stem of input.stems??[]){
    assertOwner(stem,input.ownerUserId,"Translation stem");
    assertCase(stem,input.caseId,"Translation stem");
    if(stem.parentArtifactId!==input.source.id)throw new Error("Translation stem lineage mismatch.");
    stems.push(await toRuntimeStem(input.store,input.ownerUserId,stem));
  }
  const receipt=await input.runtime.analyzeMixTranslation({source,stems});
  if(receipt.sampleRate!==input.source.sampleRate||receipt.channels!==input.source.channels||
     receipt.sampleCount!==input.source.sampleCount){
    throw new Error("Mix-translation analysis changed source geometry.");
  }
  const maskingValues=Object.values(receipt.maskingGraph.cumulative);
  const maskingScore=maskingValues.length
    ? maskingValues.reduce((sum,value)=>sum+value,0)/maskingValues.length
    : undefined;
  const full=receipt.bandCrestFactorDb.full;
  const limited=Object.fromEntries(Object.entries(receipt.bandCrestFactorDb).filter(([key])=>key!=="full"));
  const balance=input.tonalEnvelope?tonalBalanceDistance(receipt.tonalBalance,input.tonalEnvelope):undefined;
  const benchmarkMetrics:RestorationBenchmarkObjectiveMetrics={
    fullRangeCrestFactorDb:full,
    bandLimitedCrestFactorDb:limited,
    tonalBalanceDistance:balance,
    maskingScore,
    translationFailureCount:receipt.translationFailureCount,
  };
  const items=[
    evidence(`tonal-balance:${receipt.runtimeReceiptId}`,"music.qc.tonal-balance",input.source.id,0.8,{
      tonalBalanceJson:JSON.stringify(receipt.tonalBalance),
      tonalBalanceDistance:balance??null,
      envelopeId:input.tonalEnvelope?.id??null,
      runtimeReceiptId:receipt.runtimeReceiptId,
    }),
    evidence(`band-crest:${receipt.runtimeReceiptId}`,"music.qc.band-crest",input.source.id,0.85,{
      bandCrestFactorDbJson:JSON.stringify(receipt.bandCrestFactorDb),
      runtimeReceiptId:receipt.runtimeReceiptId,
    }),
    evidence(`masking:${receipt.runtimeReceiptId}`,"music.qc.masking-graph",input.source.id,stems.length?0.8:0.25,{
      maskingEdgesJson:JSON.stringify(receipt.maskingGraph.edges),
      cumulativeMaskingJson:JSON.stringify(receipt.maskingGraph.cumulative),
      maskingScore:maskingScore??null,
      runtimeReceiptId:receipt.runtimeReceiptId,
    }),
    evidence(`translation:${receipt.runtimeReceiptId}`,"music.qc.translation",input.source.id,0.9,{
      translationsJson:JSON.stringify(receipt.translations),
      translationFailureCount:receipt.translationFailureCount,
      ephemeralSimulations:true,
      runtimeReceiptId:receipt.runtimeReceiptId,
    }),
  ];
  return {receipt,evidence:items,benchmarkMetrics};
}
