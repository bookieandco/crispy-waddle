export type WorkSessionStatus='active'|'waiting-approval'|'completed'|'abandoned';

export interface WorkSessionArtifactRef {
  id:string;
  kind:'screen'|'image'|'audio'|'video'|'document'|'code'|'data';
  provenanceRef:string;
  admitted:boolean;
}

export interface JhadinaWorkSession {
  id:string;
  ownerUserId:string;
  createdAt:string;
  updatedAt:string;
  status:WorkSessionStatus;
  goal:string;
  activeSubsystems:readonly string[];
  artifactRefs:readonly WorkSessionArtifactRef[];
  decisionRefs:readonly string[];
  outputRefs:readonly string[];
}

export interface WorkSessionRepository {
  get(id:string):Promise<JhadinaWorkSession|null>;
  save(session:JhadinaWorkSession):Promise<void>;
}

export function createWorkSession(input:{id:string;ownerUserId:string;goal:string;createdAt?:string}):JhadinaWorkSession{
  const at=input.createdAt??new Date().toISOString();
  if(!input.id.trim()||!input.ownerUserId.trim()||!input.goal.trim())throw new Error('WORK_SESSION_REQUIRED_FIELDS');
  return Object.freeze({id:input.id,ownerUserId:input.ownerUserId,goal:input.goal,createdAt:at,updatedAt:at,status:'active',activeSubsystems:Object.freeze([]),artifactRefs:Object.freeze([]),decisionRefs:Object.freeze([]),outputRefs:Object.freeze([])});
}

export function evolveWorkSession(session:JhadinaWorkSession,patch:{status?:WorkSessionStatus;activeSubsystems?:readonly string[];artifactRefs?:readonly WorkSessionArtifactRef[];decisionRefs?:readonly string[];outputRefs?:readonly string[];updatedAt?:string}):JhadinaWorkSession{
  return Object.freeze({...session,...patch,updatedAt:patch.updatedAt??new Date().toISOString(),
    activeSubsystems:Object.freeze([...(patch.activeSubsystems??session.activeSubsystems)]),
    artifactRefs:Object.freeze([...(patch.artifactRefs??session.artifactRefs)]),
    decisionRefs:Object.freeze([...(patch.decisionRefs??session.decisionRefs)]),
    outputRefs:Object.freeze([...(patch.outputRefs??session.outputRefs)]),
  });
}
