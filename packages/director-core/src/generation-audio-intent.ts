export type GeneratedAudioRole=
  | 'dialogue'
  | 'music'
  | 'foley'
  | 'sfx'
  | 'ambience'
  | 'nonverbal-vocalization';

export interface GenerationAudioIntent {
  id:string;
  projectId:string;
  sceneId:string;
  allowedRoles:readonly GeneratedAudioRole[];
  forbiddenRoles:readonly GeneratedAudioRole[];
  forbidUnrequestedMusic:boolean;
  notes:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_GENERATION_AUDIO_INTENT';
}

export function validateGenerationAudioIntent(
  intent:GenerationAudioIntent,
):readonly string[]{
  const reasons:string[]=[];
  if(!intent.id.trim()||!intent.projectId.trim()||!intent.sceneId.trim()){
    reasons.push('DIRECTOR_GENERATION_AUDIO_INTENT_IDENTITY_REQUIRED');
  }
  if(!intent.allowedRoles.length) reasons.push('DIRECTOR_GENERATION_AUDIO_INTENT_ALLOWED_ROLE_REQUIRED');
  if(!intent.evidenceIds.length) reasons.push('DIRECTOR_GENERATION_AUDIO_INTENT_EVIDENCE_REQUIRED');
  const allowed=new Set(intent.allowedRoles);
  for(const role of intent.forbiddenRoles){
    if(allowed.has(role)) reasons.push(`DIRECTOR_GENERATION_AUDIO_INTENT_ROLE_CONFLICT:${role}`);
  }
  if(intent.forbidUnrequestedMusic&&!intent.forbiddenRoles.includes('music')){
    reasons.push('DIRECTOR_GENERATION_AUDIO_INTENT_MUSIC_MUST_BE_FORBIDDEN');
  }
  return Object.freeze([...new Set(reasons)]);
}

export function compileGenerationAudioIntent(
  intent:GenerationAudioIntent,
):string{
  const reasons=validateGenerationAudioIntent(intent);
  if(reasons.length) throw new Error(`DIRECTOR_GENERATION_AUDIO_INTENT_INVALID: ${reasons.join(', ')}`);
  const lines=[
    `Generate audio roles: ${intent.allowedRoles.join(', ')}.`,
    intent.forbiddenRoles.length ? `Do not generate: ${intent.forbiddenRoles.join(', ')}.` : undefined,
    intent.forbidUnrequestedMusic ? 'Do not introduce music unless it is explicitly supplied as an approved source.' : undefined,
    ...intent.notes,
  ].filter((line):line is string=>Boolean(line?.trim()));
  return lines.join('\n');
}
