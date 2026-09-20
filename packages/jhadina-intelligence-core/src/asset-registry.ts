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
export class GovernedAssetRegistry {
 constructor(private readonly store:IntelligenceAssetStore,private readonly now:()=>Date=()=>new Date()){}
 async register(input:AssetRegistrationInput):Promise<RegisteredIntelligenceAsset>{
  if(!input.actorId.trim()) throw new Error('ASSET_ACTOR_REQUIRED');
  if(!input.storageRef.trim()) throw new Error('ASSET_STORAGE_REFERENCE_REQUIRED');
  if(!input.mediaType.trim()) throw new Error('ASSET_MEDIA_TYPE_REQUIRED');
  if(input.byteLength!==undefined&&(!Number.isInteger(input.byteLength)||input.byteLength<0)) throw new Error('ASSET_BYTE_LENGTH_INVALID');
  if(input.contentSha256!==undefined&&!/^[a-f0-9]{64}$/i.test(input.contentSha256)) throw new Error('ASSET_SHA256_INVALID');
  const id=`asset_${createHash('sha256').update(JSON.stringify([input.actorId,input.storageRef,input.contentSha256??null])).digest('hex').slice(0,24)}`;
  const asset:Object & RegisteredIntelligenceAsset={id,actorId:input.actorId,modality:input.modality,mediaType:input.mediaType,assetRef:input.storageRef,filename:input.filename,privacyClass:input.privacyClass,createdAt:input.createdAt??this.now().toISOString(),contentSha256:input.contentSha256,byteLength:input.byteLength,status:'registered'};
  await this.store.register(asset); await this.store.appendProvenance({assetId:id,actorId:input.actorId,type:'registered',at:asset.createdAt,contentSha256:input.contentSha256});
  return Object.freeze(asset);
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
