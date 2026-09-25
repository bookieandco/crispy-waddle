import type {
  CharacterReplacementAdapter,
  CharacterReplacementArtifact,
  CharacterReplacementEnvironmentMode,
  CharacterReplacementInput,
} from './studio-character-replacement'

export interface ReplacementWorkerClient { post(path:string,body:unknown):Promise<unknown> }

type Response={
  artifactId:string
  trackingArtifactId:string
  compositeEvidenceIds:string[]
  continuityRef?:string
  motionReferenceAssetId:string
  environmentMode:CharacterReplacementEnvironmentMode
  environmentReferenceAssetId?:string
}

function parse(v:unknown):Response{
  if(!v||typeof v!=='object') throw new Error('Replacement worker returned invalid response')
  const r=v as Record<string,unknown>
  if(
    typeof r.artifactId!=='string'||
    typeof r.trackingArtifactId!=='string'||
    typeof r.motionReferenceAssetId!=='string'||
    (r.environmentMode!=='preserve-source'&&r.environmentMode!=='reference-frame'&&r.environmentMode!=='regenerate')||
    (r.environmentReferenceAssetId!==undefined&&typeof r.environmentReferenceAssetId!=='string')||
    !Array.isArray(r.compositeEvidenceIds)||
    !r.compositeEvidenceIds.every(x=>typeof x==='string')
  ) throw new Error('Replacement worker returned invalid response')
  return r as unknown as Response
}

export function createCharacterReplacementWorkerAdapter(
  client:ReplacementWorkerClient,
  endpoint='/v1/composite',
):CharacterReplacementAdapter{
  return {
    name:'replacement-worker',
    async composite(input:CharacterReplacementInput):Promise<CharacterReplacementArtifact>{
      const r=parse(await client.post(endpoint,{
        sourceAssetId:input.sourceAssetId,
        replacementAssetId:input.replacementAssetId,
        trackingArtifactId:input.trackingArtifactId,
        approvedTrackIds:input.tracks.map(t=>t.trackId),
        preserveMotion:input.preserveMotion,
        preserveFacialMotion:input.preserveFacialMotion,
        preserveLighting:input.preserveLighting,
        preserveOrientation:input.preserveOrientation,
        environmentMode:input.environmentMode,
        environmentReferenceAssetId:input.environmentReferenceAssetId,
        motionReferenceAssetId:input.motionReferenceAssetId,
        sourceDimensions:input.sourceDimensions,
        replacementDimensions:input.replacementDimensions,
        aspectRatioPolicy:input.aspectRatioPolicy,
        continuityRef:input.continuityRef,
      }))
      if(r.trackingArtifactId!==input.trackingArtifactId) throw new Error('Replacement worker changed tracking evidence')
      if(r.continuityRef!==input.continuityRef) throw new Error('Replacement worker changed continuity reference')
      if(r.motionReferenceAssetId!==input.motionReferenceAssetId) throw new Error('Replacement worker changed motion reference')
      if(r.environmentMode!==input.environmentMode) throw new Error('Replacement worker changed environment mode')
      if(r.environmentReferenceAssetId!==input.environmentReferenceAssetId) throw new Error('Replacement worker changed environment reference')
      return {
        artifactId:r.artifactId,
        sourceAssetId:input.sourceAssetId,
        replacementAssetId:input.replacementAssetId,
        trackingArtifactId:r.trackingArtifactId,
        provider:'replacement-worker',
        compositeEvidenceIds:r.compositeEvidenceIds,
        continuityRef:r.continuityRef,
      }
    },
  }
}
