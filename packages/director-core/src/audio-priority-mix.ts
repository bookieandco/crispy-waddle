import type {AudioMixRole} from './audio-mix-safety.js';

export interface AudioPriorityRule {
  higherPriority:AudioMixRole;
  lowerPriority:AudioMixRole;
  whenOverlapping:'duck-lower'|'manual-balance';
  rationale:string;
  evidenceIds:readonly string[];
}

export interface AudioPriorityMixPlan {
  id:string;
  projectId:string;
  priorityOrder:readonly AudioMixRole[];
  rules:readonly AudioPriorityRule[];
  notes:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_AUDIO_PRIORITY_PLAN';
}

export function validateAudioPriorityMixPlan(plan:AudioPriorityMixPlan):readonly string[]{
  const reasons:string[]=[];
  if(!plan.id.trim()||!plan.projectId.trim()) reasons.push('DIRECTOR_AUDIO_PRIORITY_IDENTITY_REQUIRED');
  if(!plan.priorityOrder.length) reasons.push('DIRECTOR_AUDIO_PRIORITY_ORDER_REQUIRED');
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_AUDIO_PRIORITY_EVIDENCE_REQUIRED');

  const unique=new Set(plan.priorityOrder);
  if(unique.size!==plan.priorityOrder.length) reasons.push('DIRECTOR_AUDIO_PRIORITY_DUPLICATE_ROLE');

  const rank=new Map(plan.priorityOrder.map((role,index)=>[role,index]));
  for(const [index,rule] of plan.rules.entries()){
    if(!rule.rationale.trim()||!rule.evidenceIds.length){
      reasons.push(`DIRECTOR_AUDIO_PRIORITY_RULE_INVALID:${index}`);
    }
    if(rule.higherPriority===rule.lowerPriority){
      reasons.push(`DIRECTOR_AUDIO_PRIORITY_RULE_SELF_REFERENCE:${index}`);
    }
    const higher=rank.get(rule.higherPriority);
    const lower=rank.get(rule.lowerPriority);
    if(higher===undefined||lower===undefined){
      reasons.push(`DIRECTOR_AUDIO_PRIORITY_RULE_ROLE_MISSING:${index}`);
    }else if(higher>=lower){
      reasons.push(`DIRECTOR_AUDIO_PRIORITY_RULE_ORDER_CONFLICT:${index}`);
    }
  }
  return Object.freeze([...new Set(reasons)]);
}

export const DIALOGUE_FIRST_MIX_PROFILE:AudioPriorityMixPlan=Object.freeze({
  id:'audio-priority:dialogue-first:v1',
  projectId:'template',
  priorityOrder:Object.freeze(['dialogue','music','foley','sfx','ambience'] as AudioMixRole[]),
  rules:Object.freeze([
    Object.freeze({
      higherPriority:'dialogue' as const,
      lowerPriority:'music' as const,
      whenOverlapping:'duck-lower' as const,
      rationale:'Preserve intelligible speech while allowing music to rise when dialogue leaves space.',
      evidenceIds:Object.freeze(['source:masterclass:audio-mix-priority']),
    }),
    Object.freeze({
      higherPriority:'dialogue' as const,
      lowerPriority:'sfx' as const,
      whenOverlapping:'manual-balance' as const,
      rationale:'Effects support the scene and may be raised for emphasis without masking dialogue.',
      evidenceIds:Object.freeze(['source:masterclass:audio-mix-priority']),
    }),
  ]),
  notes:Object.freeze([
    'Project-specific gains and loudness targets must be measured/adapted; source example values are not universal defaults.',
  ]),
  evidenceIds:Object.freeze(['source:masterclass:audio-mix-priority']),
  authority:'DIRECTOR_AUDIO_PRIORITY_PLAN',
});
