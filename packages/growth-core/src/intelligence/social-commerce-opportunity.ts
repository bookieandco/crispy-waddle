import type { GrowthId, ISODateTime } from '../domain/types.js';

export type SocialCommerceRail =
  | 'tiktok_shop'
  | 'instagram_shop'
  | 'affiliate_link'
  | 'creator_whitelisting'
  | 'dm_commerce'
  | 'agent_assisted_commerce'
  | 'visual_product_discovery'
  | (string & {});

export interface MonetizationRailSignal{
  id:GrowthId;
  rail:SocialCommerceRail;
  state:'observed'|'emerging'|'hypothesis';
  description:string;
  sourceRefs:readonly string[];
  observedAt:ISODateTime;
  monetizationModel:'direct_sale'|'affiliate'|'lead'|'rev_share'|'owned_product'|'other';
  frictionScore:number;
  evidenceQuality:number;
}

export interface MonetizationRailOpportunity{
  rail:SocialCommerceRail;
  score:number;
  state:MonetizationRailSignal['state'];
  sourceSignalIds:readonly GrowthId[];
  rationale:string;
  authority:'OPPORTUNITY_ONLY';
}

function clamp(value:number){return Math.max(0,Math.min(1,value))}

export function rankMonetizationRails(
  signals:readonly MonetizationRailSignal[],
):MonetizationRailOpportunity[]{
  const groups=new Map<string,MonetizationRailSignal[]>();
  for(const signal of signals){
    if(!signal.id.trim()||!signal.rail.trim()||!signal.description.trim())throw new Error('GROWTH_SOCIAL_COMMERCE_FIELDS_REQUIRED');
    if(!signal.sourceRefs.length)throw new Error('GROWTH_SOCIAL_COMMERCE_EVIDENCE_REQUIRED');
    if(!Number.isFinite(Date.parse(signal.observedAt)))throw new Error('GROWTH_SOCIAL_COMMERCE_TIME_INVALID');
    const group=groups.get(signal.rail)??[];group.push(signal);groups.set(signal.rail,group);
  }
  return [...groups.values()].map(group=>{
    const evidence=group.reduce((sum,item)=>sum+clamp(item.evidenceQuality),0)/group.length;
    const friction=group.reduce((sum,item)=>sum+clamp(item.frictionScore),0)/group.length;
    const state=group.some(item=>item.state==='observed')?'observed':
      group.some(item=>item.state==='emerging')?'emerging':'hypothesis';
    const stateWeight=state==='observed'?1:state==='emerging'?0.7:0.35;
    const score=clamp(evidence*0.55+(1-friction)*0.25+stateWeight*0.2);
    return{
      rail:group[0]!.rail,
      score,
      state,
      sourceSignalIds:Object.freeze(group.map(item=>item.id)),
      rationale:`${group.length} evidence signal(s); state=${state}; evidence=${evidence.toFixed(2)}; friction=${friction.toFixed(2)}.`,
      authority:'OPPORTUNITY_ONLY' as const,
    };
  }).sort((a,b)=>b.score-a.score);
}
