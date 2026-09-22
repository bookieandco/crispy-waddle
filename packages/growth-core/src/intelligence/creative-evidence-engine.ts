import type { GrowthId, ISODateTime } from '../domain/types.js';
import type { CreativeFormat } from './creative-pack.js';

export type CreativeEvidenceClass =
  | 'first_party_performance'
  | 'customer_language'
  | 'organic_pattern'
  | 'competitor_pattern'
  | 'expert_heuristic';

export interface CreativeEvidenceSignal {
  id: GrowthId;
  evidenceClass: CreativeEvidenceClass;
  bigIdea: string;
  sourceRefs: readonly string[];
  observedAt: ISODateTime;
  recurrence?: number;
  spend?: number;
  conversions?: number;
  contributionMargin?: number;
  format?: CreativeFormat;
}

export interface RankedBigIdea {
  bigIdea: string;
  evidenceScore: number;
  firstPartySupport: boolean;
  supportingSignalIds: readonly GrowthId[];
  evidenceClasses: readonly CreativeEvidenceClass[];
  status: 'validated' | 'promising' | 'hypothesis';
}

const BASE_WEIGHT: Readonly<Record<CreativeEvidenceClass, number>> = {
  first_party_performance: 0.95,
  customer_language: 0.75,
  organic_pattern: 0.65,
  competitor_pattern: 0.35,
  expert_heuristic: 0.2,
};

const PRODUCTION_EFFORT: Readonly<Record<CreativeFormat, number>> = {
  image: 1,
  carousel: 2,
  meme: 2,
  testimonial: 3,
  educational: 3,
  talking_head: 4,
  ugc: 5,
  product_demo: 6,
  short_video: 7,
};

const SENSITIVE_CONTEXT_TERMS = new Set([
  'race','ethnicity','religion','health','medical','disability','political','politics','party','union',
  'gender','sex','sexual_orientation','sexuality','sex_life','criminal_history','pregnancy','fertility',
]);

const clean=(value:string)=>value.replace(/\s+/g,' ').trim();
const normalized=(value:string)=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');

function assertSignal(signal:CreativeEvidenceSignal):void{
  if(!signal.id.trim()) throw new Error('GROWTH_CREATIVE_SIGNAL_ID_REQUIRED');
  if(!clean(signal.bigIdea)) throw new Error('GROWTH_CREATIVE_BIG_IDEA_REQUIRED');
  if(!signal.sourceRefs.length) throw new Error('GROWTH_CREATIVE_EVIDENCE_REQUIRED');
  if(!Number.isFinite(Date.parse(signal.observedAt))) throw new Error('GROWTH_CREATIVE_OBSERVED_AT_INVALID');
  if(signal.recurrence!==undefined&&(!Number.isInteger(signal.recurrence)||signal.recurrence<1)){
    throw new Error('GROWTH_CREATIVE_RECURRENCE_INVALID');
  }
}

function signalWeight(signal:CreativeEvidenceSignal):number{
  assertSignal(signal);
  let score=BASE_WEIGHT[signal.evidenceClass]+Math.min(0.12,Math.log2(Math.max(1,signal.recurrence??1))*0.03);
  if(signal.evidenceClass==='first_party_performance'){
    if((signal.spend??0)>0) score+=Math.min(0.03,Math.log10((signal.spend??0)+1)*0.005);
    if((signal.conversions??0)>0) score+=Math.min(0.03,Math.log10((signal.conversions??0)+1)*0.006);
    if((signal.contributionMargin??0)>0) score+=0.02;
  }
  // External patterns can justify a test but cannot become conversion proof by repetition alone.
  if(signal.evidenceClass==='competitor_pattern') score=Math.min(score,0.5);
  if(signal.evidenceClass==='expert_heuristic') score=Math.min(score,0.35);
  return Math.max(0,Math.min(1,score));
}

export function rankBigIdeas(signals:readonly CreativeEvidenceSignal[]):RankedBigIdea[]{
  const groups=new Map<string,CreativeEvidenceSignal[]>();
  for(const signal of signals){
    assertSignal(signal);
    const k=normalized(signal.bigIdea);
    const group=groups.get(k)??[];
    group.push(signal);
    groups.set(k,group);
  }

  return [...groups.values()].map(group=>{
    const firstPartySupport=group.some(signal=>signal.evidenceClass==='first_party_performance');
    const customerOrOrganicSupport=group.some(signal=>
      signal.evidenceClass==='customer_language'||signal.evidenceClass==='organic_pattern');
    const evidenceScore=Math.max(0,Math.min(
      1,
      1-group.reduce((remaining,signal)=>remaining*(1-signalWeight(signal)),1),
    ));
    const status:RankedBigIdea['status']=
      firstPartySupport&&evidenceScore>=0.8?'validated':
      (firstPartySupport||customerOrOrganicSupport)&&evidenceScore>=0.6?'promising':'hypothesis';
    return{
      bigIdea:clean(group[0]!.bigIdea),
      evidenceScore,
      firstPartySupport,
      supportingSignalIds:Object.freeze(group.map(signal=>signal.id)),
      evidenceClasses:Object.freeze([...new Set(group.map(signal=>signal.evidenceClass))]),
      status,
    };
  }).sort((a,b)=>b.evidenceScore-a.evidenceScore);
}

export interface CreativeTestCandidate{
  id:GrowthId;
  bigIdea:string;
  format:CreativeFormat;
  evidenceScore:number;
  expectedLearningSpeed:number;
  scalePotential:number;
  productionEffort?:number;
}

export interface PrioritizedCreativeTest extends CreativeTestCandidate{
  productionEffort:number;
  priorityScore:number;
}

export function prioritizeCreativeTests(candidates:readonly CreativeTestCandidate[]):PrioritizedCreativeTest[]{
  return candidates.map(candidate=>{
    const productionEffort=candidate.productionEffort??PRODUCTION_EFFORT[candidate.format];
    const evidence=Math.max(0,Math.min(1,candidate.evidenceScore));
    const speed=Math.max(0,Math.min(1,candidate.expectedLearningSpeed));
    const scale=Math.max(0,Math.min(1,candidate.scalePotential));
    const priorityScore=evidence*0.45+speed*0.3+scale*0.2-Math.min(1,productionEffort/10)*0.15;
    return{...candidate,productionEffort,priorityScore};
  }).sort((a,b)=>b.priorityScore-a.priorityScore);
}

export function recommendValidationFormat(
  idea:RankedBigIdea,
  available:readonly CreativeFormat[]=['image','carousel','talking_head','ugc','short_video'],
):CreativeFormat{
  if(!available.length) throw new Error('GROWTH_CREATIVE_FORMAT_REQUIRED');
  const ranked=[...available].sort((a,b)=>PRODUCTION_EFFORT[a]-PRODUCTION_EFFORT[b]);
  if(idea.status==='hypothesis') return ranked[0]!;
  if(idea.status==='promising') return ranked.find(format=>PRODUCTION_EFFORT[format]<=4)??ranked[0]!;
  return ranked.find(format=>format==='ugc'||format==='talking_head'||format==='short_video')??ranked[0]!;
}

export function assertCommercialContext(context:string):void{
  const tokens=normalized(context).split('_').filter(Boolean);
  if(tokens.some(token=>SENSITIVE_CONTEXT_TERMS.has(token))){
    throw new Error('GROWTH_SENSITIVE_CREATIVE_CONTEXT_FORBIDDEN');
  }
}

export interface CreativeEcosystemVariant{
  id:GrowthId;
  bigIdea:string;
  format:CreativeFormat;
  commercialContext?:string;
  relationship:'format_translation'|'context_translation'|'hook_variation';
  sourceSignalIds:readonly GrowthId[];
}

export function buildCreativeEcosystem(input:{
  idea:RankedBigIdea;
  formats:readonly CreativeFormat[];
  commercialContexts?:readonly string[];
  hookVariants?:number;
}):CreativeEcosystemVariant[]{
  if(!input.formats.length) throw new Error('GROWTH_CREATIVE_FORMAT_REQUIRED');
  const variants:CreativeEcosystemVariant[]=[];
  for(const context of input.commercialContexts??[]) assertCommercialContext(context);

  for(const format of input.formats) variants.push({
    id:`creative-ecosystem:${normalized(input.idea.bigIdea)}:format:${format}`,
    bigIdea:input.idea.bigIdea,
    format,
    relationship:'format_translation',
    sourceSignalIds:input.idea.supportingSignalIds,
  });

  for(const context of input.commercialContexts??[]) variants.push({
    id:`creative-ecosystem:${normalized(input.idea.bigIdea)}:context:${normalized(context)}`,
    bigIdea:input.idea.bigIdea,
    format:recommendValidationFormat(input.idea,input.formats),
    commercialContext:clean(context),
    relationship:'context_translation',
    sourceSignalIds:input.idea.supportingSignalIds,
  });

  for(let index=0;index<Math.max(0,Math.min(20,input.hookVariants??0));index+=1) variants.push({
    id:`creative-ecosystem:${normalized(input.idea.bigIdea)}:hook:${index+1}`,
    bigIdea:input.idea.bigIdea,
    format:recommendValidationFormat(input.idea,input.formats),
    relationship:'hook_variation',
    sourceSignalIds:input.idea.supportingSignalIds,
  });

  return variants;
}
