import type { CharacterReplacementAdapter, CharacterReplacementArtifact, CharacterReplacementInput } from './studio-character-replacement'
export interface ReplacementWorkerClient { post(path:string,body:unknown):Promise<unknown> }
type Response={artifactId:string;trackingArtifactId:string;compositeEvidenceIds:string[];continuityRef?:string}
function parse(v:unknown):Response{
 if(!v||typeof v!=='object') throw new Error('Replacement worker returned invalid response')
 const r=v as Record<string,unknown>
 if(typeof r.artifactId!=='string'||typeof r.trackingArtifactId!=='string'||!Array.isArray(r.compositeEvidenceIds)||!r.compositeEvidenceIds.every(x=>typeof x==='string')) throw new Error('Replacement worker returned invalid response')
 return r as unknown as Response
}
export function createCharacterReplacementWorkerAdapter(client:ReplacementWorkerClient,endpoint='/v1/composite'):CharacterReplacementAdapter{
 return {name:'replacement-worker',async composite(input:CharacterReplacementInput):Promise<CharacterReplacementArtifact>{
  const r=parse(await client.post(endpoint,{sourceAssetId:input.sourceAssetId,replacementAssetId:input.replacementAssetId,trackingArtifactId:input.trackingArtifactId,approvedTrackIds:input.tracks.map(t=>t.trackId),preserveMotion:input.preserveMotion,preserveLighting:input.preserveLighting,continuityRef:input.continuityRef}))
  if(r.trackingArtifactId!==input.trackingArtifactId) throw new Error('Replacement worker changed tracking evidence')
  if(r.continuityRef!==input.continuityRef) throw new Error('Replacement worker changed continuity reference')
  return {...r,sourceAssetId:input.sourceAssetId,replacementAssetId:input.replacementAssetId,provider:'replacement-worker'}
 }}
}
