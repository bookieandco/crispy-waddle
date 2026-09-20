import type { IntelligencePrivacyClass } from './intelligence-fabric.js';

export type IntakeModality = 'image'|'audio'|'video'|'document'|'text'|'code';

export type SubsystemId =
 | 'sports-intelligence'|'jhadina-media'|'director-studio'|'creative-engine'
 | 'overageos'|'knowledge'|'research';

export interface IntelligenceAsset {
 readonly id:string;
 readonly actorId:string;
 readonly modality:IntakeModality;
 readonly mediaType:string;
 readonly assetRef:string;
 readonly filename?:string;
 readonly privacyClass:IntelligencePrivacyClass;
 readonly createdAt:string;
}

export interface SubsystemRoute {
 readonly subsystem:SubsystemId;
 readonly reason:string;
 readonly confidence:number;
}

export interface IntakeRoutingDecision {
 readonly assetId:string;
 readonly routes:readonly SubsystemRoute[];
 readonly requiresHumanSelection:boolean;
}

export interface UniversalIntakeRouter {
 route(asset:IntelligenceAsset, intent?:string):Promise<IntakeRoutingDecision>;
}

/**
 * Classification/routing only. An uploaded asset is data, never authority.
 * This layer does not execute subsystem work, mutate memory, or publish media.
 */
export class GovernedUniversalIntakeRouter implements UniversalIntakeRouter {
 async route(asset:IntelligenceAsset,intent=''):Promise<IntakeRoutingDecision>{
  if(!asset.actorId.trim()) throw new Error('INTAKE_ACTOR_REQUIRED');
  if(!asset.assetRef.trim()) throw new Error('INTAKE_ASSET_REFERENCE_REQUIRED');
  const text=`${asset.filename??''} ${intent}`.toLowerCase();
  const routes:SubsystemRoute[]=[];
  const add=(subsystem:SubsystemId,reason:string,confidence:number)=>routes.push({subsystem,reason,confidence});
  if(/boxing|basketball|football|soccer|tennis|game|match|fight|coach|athlete|sports?/.test(text))
   add('sports-intelligence','Sports-related filename or intent',.92);
  if(/song|music|audio|track|stem|beat|lyrics|album|voice|podcast/.test(text))
   add('jhadina-media','Music/audio/media intent',.9);
  if(/film|movie|scene|shot|character|animation|vfx|director|footage/.test(text))
   add('director-studio','Film/video production intent',.9);
  if(/pet|dog|cat|pup|product|pod|printify|merch/.test(text))
   add('creative-engine','Creative/POD asset intent',.88);
  if(/overage|tax sale|surplus|county|unclaimed|lien|parcel/.test(text))
   add('overageos','Property/overage research intent',.9);
  if(/research|study|paper|source|citation/.test(text))
   add('research','Research intent',.82);
  if(!routes.length) add(asset.modality==='document'?'knowledge':'research','No specific subsystem signal; route to read-only analysis',.55);
  return Object.freeze({assetId:asset.id,routes:Object.freeze(routes),requiresHumanSelection:routes.length>1});
 }
}
