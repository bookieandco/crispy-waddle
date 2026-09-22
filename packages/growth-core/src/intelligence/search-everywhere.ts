import type { GrowthId, ISODateTime } from '../domain/types.js';

export type AnswerSurface =
  | 'search:google'
  | 'search:ai'
  | 'social:youtube'
  | 'social:tiktok'
  | 'community:reddit'
  | 'social:instagram'
  | 'social:x'
  | (string & {});

export interface CoreAnswer {
  id: GrowthId;
  brandId: GrowthId;
  question: string;
  answer: string;
  claims: readonly string[];
  evidenceRefs: readonly string[];
  createdAt: ISODateTime;
  authority: 'CONTENT_STRATEGY_ONLY';
}

export interface SurfaceTranslation {
  id: GrowthId;
  coreAnswerId: GrowthId;
  surfaceId: AnswerSurface;
  format: 'article' | 'video' | 'short_video' | 'community_post' | 'social_post' | 'answer_snippet' | 'other';
  title: string;
  message: string;
  evidenceRefs: readonly string[];
  sourceAssetId?: GrowthId;
  authority: 'CONTENT_DRAFT_ONLY';
}

export interface ThirdPartyVerification {
  id: GrowthId;
  coreAnswerId: GrowthId;
  source: string;
  sourceLocator: string;
  kind: 'mention' | 'review' | 'citation' | 'discussion' | 'comparison' | 'other';
  polarity: 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown';
  observedAt: ISODateTime;
  evidenceRefs: readonly string[];
}

export interface MessageConsistencyResult {
  coreAnswerId: GrowthId;
  alignedSurfaceIds: readonly string[];
  driftedSurfaceIds: readonly string[];
  missingEvidenceSurfaceIds: readonly string[];
  consistencyScore: number;
  status: 'aligned' | 'review_required';
}

function clean(value:string):string{return value.replace(/\s+/g,' ').trim()}
function tokenize(value:string):Set<string>{
  return new Set(clean(value).toLowerCase().split(/[^a-z0-9]+/).filter(token=>token.length>2));
}
function similarity(a:string,b:string):number{
  const aa=tokenize(a),bb=tokenize(b);
  if(!aa.size&&!bb.size)return 1;
  const intersection=[...aa].filter(token=>bb.has(token)).length;
  const union=new Set([...aa,...bb]).size||1;
  return intersection/union;
}

export function createCoreAnswer(input:Omit<CoreAnswer,'authority'>):CoreAnswer{
  if(!input.id.trim()||!input.brandId.trim())throw new Error('GROWTH_SEARCH_EVERYWHERE_ID_REQUIRED');
  if(!clean(input.question)||!clean(input.answer))throw new Error('GROWTH_SEARCH_EVERYWHERE_ANSWER_REQUIRED');
  if(!input.evidenceRefs.length)throw new Error('GROWTH_SEARCH_EVERYWHERE_EVIDENCE_REQUIRED');
  if(!Number.isFinite(Date.parse(input.createdAt)))throw new Error('GROWTH_SEARCH_EVERYWHERE_CREATED_AT_INVALID');
  return Object.freeze({...input,authority:'CONTENT_STRATEGY_ONLY'});
}

export function createSurfaceTranslation(
  core:CoreAnswer,
  input:Omit<SurfaceTranslation,'coreAnswerId'|'authority'>,
):SurfaceTranslation{
  if(!input.id.trim()||!input.surfaceId.trim())throw new Error('GROWTH_SEARCH_EVERYWHERE_SURFACE_REQUIRED');
  if(!clean(input.title)||!clean(input.message))throw new Error('GROWTH_SEARCH_EVERYWHERE_MESSAGE_REQUIRED');
  return Object.freeze({...input,coreAnswerId:core.id,authority:'CONTENT_DRAFT_ONLY'});
}

export function assessMessageConsistency(
  core:CoreAnswer,
  translations:readonly SurfaceTranslation[],
  minimumSimilarity=0.08,
):MessageConsistencyResult{
  if(minimumSimilarity<0||minimumSimilarity>1)throw new Error('GROWTH_SEARCH_EVERYWHERE_SIMILARITY_INVALID');
  const aligned:string[]=[],drifted:string[]=[],missingEvidence:string[]=[];
  for(const translation of translations){
    if(translation.coreAnswerId!==core.id)continue;
    const score=similarity(
      `${core.question} ${core.answer} ${core.claims.join(' ')}`,
      `${translation.title} ${translation.message}`,
    );
    if(score>=minimumSimilarity)aligned.push(translation.surfaceId);
    else drifted.push(translation.surfaceId);
    if(!translation.evidenceRefs.length)missingEvidence.push(translation.surfaceId);
  }
  const total=Math.max(1,aligned.length+drifted.length);
  const consistencyScore=Math.max(0,Math.min(1,(aligned.length-missingEvidence.length*0.5)/total));
  return{
    coreAnswerId:core.id,
    alignedSurfaceIds:Object.freeze(aligned),
    driftedSurfaceIds:Object.freeze(drifted),
    missingEvidenceSurfaceIds:Object.freeze(missingEvidence),
    consistencyScore,
    status:drifted.length||missingEvidence.length?'review_required':'aligned',
  };
}

export interface VerificationSummary{
  coreAnswerId:GrowthId;
  mentionCount:number;
  distinctSources:number;
  positive:number;
  neutral:number;
  negative:number;
  mixed:number;
  evidenceRefs:readonly string[];
}

export function summarizeThirdPartyVerification(
  core:CoreAnswer,
  observations:readonly ThirdPartyVerification[],
):VerificationSummary{
  const rows=observations.filter(row=>row.coreAnswerId===core.id);
  for(const row of rows){
    if(!row.source.trim()||!row.sourceLocator.trim()||!row.evidenceRefs.length){
      throw new Error('GROWTH_SEARCH_EVERYWHERE_VERIFICATION_EVIDENCE_REQUIRED');
    }
    if(!Number.isFinite(Date.parse(row.observedAt))){
      throw new Error('GROWTH_SEARCH_EVERYWHERE_VERIFICATION_TIME_INVALID');
    }
  }
  return{
    coreAnswerId:core.id,
    mentionCount:rows.length,
    distinctSources:new Set(rows.map(row=>row.source)).size,
    positive:rows.filter(row=>row.polarity==='positive').length,
    neutral:rows.filter(row=>row.polarity==='neutral').length,
    negative:rows.filter(row=>row.polarity==='negative').length,
    mixed:rows.filter(row=>row.polarity==='mixed').length,
    evidenceRefs:Object.freeze([...new Set(rows.flatMap(row=>row.evidenceRefs))]),
  };
}
