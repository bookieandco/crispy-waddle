import type { GrowthId } from '../domain/types.js';

export interface ContentResearchObservation{
  id:GrowthId;
  sourceUrl:string;
  topic:string;
  topicCategory:string;
  hook:string;
  hookFormat:string;
  views?:number;
  engagementRate?:number;
  outlierScore?:number;
  transcriptEvidenceRefs:readonly string[];
}

export interface TopicCluster{
  topicCategory:string;
  totalViews:number;
  observationIds:readonly GrowthId[];
  ideaSeeds:readonly string[];
}

export function clusterContentTopics(
  observations:readonly ContentResearchObservation[],
):TopicCluster[]{
  const groups=new Map<string,ContentResearchObservation[]>();
  for(const observation of observations){
    if(!observation.id.trim()||!observation.sourceUrl.trim()||!observation.topic.trim()||!observation.topicCategory.trim()){
      throw new Error('GROWTH_CONTENT_RESEARCH_FIELDS_REQUIRED');
    }
    if(!observation.transcriptEvidenceRefs.length)throw new Error('GROWTH_CONTENT_RESEARCH_EVIDENCE_REQUIRED');
    const key=observation.topicCategory.toLowerCase().trim();
    const group=groups.get(key)??[];
    group.push(observation);groups.set(key,group);
  }
  return [...groups.values()].map(group=>({
    topicCategory:group[0]!.topicCategory,
    totalViews:group.reduce((sum,item)=>sum+Math.max(0,item.views??0),0),
    observationIds:Object.freeze(group.map(item=>item.id)),
    ideaSeeds:Object.freeze([...new Set(group.map(item=>item.topic))]),
  })).sort((a,b)=>b.totalViews-a.totalViews);
}

export interface HookCluster{
  hookFormat:string;
  observationIds:readonly GrowthId[];
  examples:readonly string[];
  totalViews:number;
}

export function clusterHooks(observations:readonly ContentResearchObservation[]):HookCluster[]{
  const groups=new Map<string,ContentResearchObservation[]>();
  for(const observation of observations){
    const key=observation.hookFormat.toLowerCase().trim();
    if(!key)throw new Error('GROWTH_CONTENT_HOOK_FORMAT_REQUIRED');
    const group=groups.get(key)??[];
    group.push(observation);groups.set(key,group);
  }
  return [...groups.values()].map(group=>({
    hookFormat:group[0]!.hookFormat,
    observationIds:Object.freeze(group.map(item=>item.id)),
    examples:Object.freeze(group.map(item=>item.hook)),
    totalViews:group.reduce((sum,item)=>sum+Math.max(0,item.views??0),0),
  })).sort((a,b)=>b.totalViews-a.totalViews);
}

export interface HumanPointOfView{
  topic:string;
  take:string;
  authorId:string;
  sourceObservationIds:readonly GrowthId[];
  authority:'HUMAN_BRAND_POV';
}

export function createHumanPointOfView(input:Omit<HumanPointOfView,'authority'>):HumanPointOfView{
  if(!input.topic.trim()||!input.take.trim()||!input.authorId.trim())throw new Error('GROWTH_HUMAN_POV_REQUIRED');
  if(!input.sourceObservationIds.length)throw new Error('GROWTH_HUMAN_POV_EVIDENCE_REQUIRED');
  return Object.freeze({...input,authority:'HUMAN_BRAND_POV'});
}

export interface StorytellingScoreInput{
  characters:number;
  pacing:number;
  narrativeArc:number;
  worldBuilding:number;
  tension:number;
}

export interface StorytellingAssessment extends StorytellingScoreInput{
  score:number;
  strongestPill:keyof StorytellingScoreInput;
  weakestPill:keyof StorytellingScoreInput;
  status:'weak'|'developing'|'strong';
}

export function assessStorytelling(input:StorytellingScoreInput):StorytellingAssessment{
  const keys=(Object.keys(input) as (keyof StorytellingScoreInput)[]);
  for(const key of keys){
    const value=input[key];
    if(!Number.isFinite(value)||value<0||value>1)throw new Error('GROWTH_STORYTELLING_SCORE_INVALID');
  }
  const score=keys.reduce((sum,key)=>sum+input[key],0)/keys.length;
  const strongestPill=[...keys].sort((a,b)=>input[b]-input[a])[0]!;
  const weakestPill=[...keys].sort((a,b)=>input[a]-input[b])[0]!;
  return{
    ...input,
    score,
    strongestPill,
    weakestPill,
    status:score>=0.75?'strong':score>=0.5?'developing':'weak',
  };
}
