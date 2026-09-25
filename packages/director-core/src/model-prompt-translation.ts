export type PromptDocumentationSourceKind='official-documentation'|'official-prompt-guide';

export interface PromptDocumentationSource {
  id:string;
  providerId:string;
  modelId:string;
  modelVersion:string;
  kind:PromptDocumentationSourceKind;
  uri?:string;
  sha256:string;
  capturedAt:string;
  evidenceIds:readonly string[];
}

export interface ModelPromptProfile {
  id:string;
  providerId:string;
  modelId:string;
  modelVersion:string;
  documentationSources:readonly PromptDocumentationSource[];
  evidenceIds:readonly string[];
  authority:'PROVIDER_PROMPT_PROFILE';
}

export interface PromptTranslationInput {
  projectId:string;
  takeId:string;
  canonicalPrompt:string;
  creativeFeedback?:readonly string[];
}

export interface PromptTranslationResult {
  profileId:string;
  providerId:string;
  modelId:string;
  modelVersion:string;
  translatedPrompt:string;
  canonicalPromptSha256:string;
  documentationSourceIds:readonly string[];
  evidenceIds:readonly string[];
  authority:'PROVIDER_PROMPT_TRANSLATION';
}

export interface ModelPromptProfileResolver {
  resolve(profileId:string):Promise<ModelPromptProfile|undefined>;
}

export interface ModelPromptTranslator {
  translate(input:PromptTranslationInput,profile:ModelPromptProfile):Promise<PromptTranslationResult>;
}

export function validateModelPromptProfile(profile:ModelPromptProfile):readonly string[]{
  const reasons:string[]=[];
  if(!profile.id.trim()||!profile.providerId.trim()||!profile.modelId.trim()||!profile.modelVersion.trim()){
    reasons.push('DIRECTOR_PROMPT_PROFILE_IDENTITY_REQUIRED');
  }
  if(!profile.documentationSources.length) reasons.push('DIRECTOR_PROMPT_PROFILE_DOCUMENTATION_REQUIRED');
  if(!profile.evidenceIds.length) reasons.push('DIRECTOR_PROMPT_PROFILE_EVIDENCE_REQUIRED');

  const sourceIds=new Set<string>();
  for(const source of profile.documentationSources){
    if(!source.id.trim()||sourceIds.has(source.id)) reasons.push(`DIRECTOR_PROMPT_SOURCE_ID_INVALID:${source.id||'unknown'}`);
    sourceIds.add(source.id);
    if(source.providerId!==profile.providerId||source.modelId!==profile.modelId||source.modelVersion!==profile.modelVersion){
      reasons.push(`DIRECTOR_PROMPT_SOURCE_MODEL_MISMATCH:${source.id}`);
    }
    if(source.kind!=='official-documentation'&&source.kind!=='official-prompt-guide'){
      reasons.push(`DIRECTOR_PROMPT_SOURCE_NOT_OFFICIAL:${source.id}`);
    }
    if(!source.sha256.trim()||!source.capturedAt.trim()||!source.evidenceIds.length){
      reasons.push(`DIRECTOR_PROMPT_SOURCE_PROVENANCE_REQUIRED:${source.id}`);
    }
  }
  return Object.freeze([...new Set(reasons)]);
}

export function validatePromptTranslationResult(
  input:PromptTranslationInput,
  profile:ModelPromptProfile,
  result:PromptTranslationResult,
):readonly string[]{
  const reasons=[...validateModelPromptProfile(profile)];
  if(result.profileId!==profile.id) reasons.push('DIRECTOR_PROMPT_TRANSLATION_PROFILE_MISMATCH');
  if(
    result.providerId!==profile.providerId||
    result.modelId!==profile.modelId||
    result.modelVersion!==profile.modelVersion
  ) reasons.push('DIRECTOR_PROMPT_TRANSLATION_MODEL_MISMATCH');
  if(!result.translatedPrompt.trim()) reasons.push('DIRECTOR_PROMPT_TRANSLATION_EMPTY');
  if(!result.canonicalPromptSha256.trim()) reasons.push('DIRECTOR_PROMPT_TRANSLATION_CANONICAL_HASH_REQUIRED');
  const expectedSources=new Set(profile.documentationSources.map(source=>source.id));
  if(!result.documentationSourceIds.length) reasons.push('DIRECTOR_PROMPT_TRANSLATION_SOURCES_REQUIRED');
  for(const sourceId of result.documentationSourceIds){
    if(!expectedSources.has(sourceId)) reasons.push(`DIRECTOR_PROMPT_TRANSLATION_SOURCE_UNKNOWN:${sourceId}`);
  }
  if(!result.evidenceIds.length) reasons.push('DIRECTOR_PROMPT_TRANSLATION_EVIDENCE_REQUIRED');
  if(!input.canonicalPrompt.trim()) reasons.push('DIRECTOR_PROMPT_TRANSLATION_CANONICAL_PROMPT_REQUIRED');
  return Object.freeze([...new Set(reasons)]);
}

export async function translatePromptForModel(
  translator:ModelPromptTranslator,
  profile:ModelPromptProfile,
  input:PromptTranslationInput,
):Promise<PromptTranslationResult>{
  const profileReasons=validateModelPromptProfile(profile);
  if(profileReasons.length) throw new Error(`DIRECTOR_PROMPT_PROFILE_INVALID: ${profileReasons.join(', ')}`);
  const result=await translator.translate(input,profile);
  const resultReasons=validatePromptTranslationResult(input,profile,result);
  if(resultReasons.length) throw new Error(`DIRECTOR_PROMPT_TRANSLATION_INVALID: ${resultReasons.join(', ')}`);
  return Object.freeze({
    ...result,
    documentationSourceIds:Object.freeze([...result.documentationSourceIds]),
    evidenceIds:Object.freeze([...result.evidenceIds]),
  });
}
