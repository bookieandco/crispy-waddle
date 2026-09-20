import { createHash } from 'node:crypto';
import type { IntakeModality, IntelligenceAsset } from './universal-intake.js';
import type { IntelligencePrivacyClass } from './intelligence-fabric.js';

export interface AssetRegistrationInput {
 readonly actorId:string; readonly modality:IntakeModality; readonly mediaType:string;
 readonly storageRef:string; readonly filename?:string; readonly byteLength?:number;
 readonly contentSha256?:string; readonly privacyClass:IntelligencePrivacyClass;
 readonly createdAt?:string;
}
export interface RegisteredIntelligenceAsset extends IntelligenceAsset {
 readonly contentSha256?:string; readonly byteLength?:number; readonly status:'registered';
}
export interface AssetProvenanceEvent {readonly assetId:string;readonly actorId:string;readonly type:'registered';readonly at:string;readonly contentSha256?:string;}
export interface IntelligenceAssetStore {register(asset:RegisteredIntelligenceAsset):Promise<void>;get(actorId:string,assetId:string):Promise<RegisteredIntelligenceAsset|undefined>;appendProvenance(event:AssetProvenanceEvent):Promise<void>;}

function sameAssetIdentity(a:RegisteredIntelligenceAsset,b:RegisteredIntelligenceAsset):boolean{
 return a.id===b.id&&a.actorId===b.actorId&&a.modality===b.modality&&a.mediaType===b.mediaType&&
  a.assetRef===b.assetRef&&(a.filename??null)===(b.filename??null)&&a.privacyClass===b.privacyClass&&
  (a.contentSha256??null)===(b.contentSha256??null)&&(a.byteLength??null)===(b.byteLength??null)&&
  a.status===b.status;
}

export class GovernedAssetRegistry {
 constructor(private readonly store:IntelligenceAssetStore,private readonly now:()=>Date=()=>new Date()){}
 async register(input:AssetRegistrationInput):Promise<RegisteredIntelligenceAsset>{
  if(!input.actorId.trim()) throw new Error('ASSET_ACTOR_REQUIRED');
  if(!input.storageRef.trim()) throw new Error('ASSET_STORAGE_REFERENCE_REQUIRED');
  if(!input.mediaType.trim()) throw new Error('ASSET_MEDIA_TYPE_REQUIRED');
  if(input.byteLength!==undefined&&(!Number.isInteger(input.byteLength)||input.byteLength<0)) throw new Error('ASSET_BYTE_LENGTH_INVALID');
  if(input.contentSha256!==undefined&&!/^[a-f0-9]{64}$/i.test(input.contentSha256)) throw new Error('ASSET_SHA256_INVALID');
  const id=`asset_${createHash('sha256').update(JSON.stringify([input.actorId,input.storageRef,input.contentSha256??null])).digest('hex').slice(0,24)}`;
  const candidate:RegisteredIntelligenceAsset={
   id,actorId:input.actorId,modality:input.modality,mediaType:input.mediaType,assetRef:input.storageRef,
   filename:input.filename,privacyClass:input.privacyClass,createdAt:input.createdAt??this.now().toISOString(),
   contentSha256:input.contentSha256,byteLength:input.byteLength,status:'registered'
  };
  const existing=await this.store.get(input.actorId,id);
  if(existing){
   if(!sameAssetIdentity(existing,candidate)) throw new Error('INTELLIGENCE_ASSET_ID_CONFLICT');
   return Object.freeze({...existing});
  }
  await this.store.register(candidate);
  await this.store.appendProvenance({assetId:id,actorId:input.actorId,type:'registered',at:candidate.createdAt,contentSha256:input.contentSha256});
  return Object.freeze(candidate);
 }
 async get(actorId:string,assetId:string){if(!actorId.trim())throw new Error('ASSET_ACTOR_REQUIRED');return this.store.get(actorId,assetId);}
}
export class InMemoryIntelligenceAssetStore implements IntelligenceAssetStore{
 private assets=new Map<string,RegisteredIntelligenceAsset>(); private provenance:AssetProvenanceEvent[]=[];
 async register(a:RegisteredIntelligenceAsset){this.assets.set(`${a.actorId}:${a.id}`,a)}
 async get(actorId:string,id:string){return this.assets.get(`${actorId}:${id}`)}
 async appendProvenance(e:AssetProvenanceEvent){this.provenance.push(e)}
 snapshotProvenance(){return Object.freeze([...this.provenance])}
}
