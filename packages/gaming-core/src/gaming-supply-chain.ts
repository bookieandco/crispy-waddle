export type GamingArtifactKind='runtime'|'emulator-core'|'browser-asset'|'controller-db'|'firmware-metadata';
export type GamingPermissionDomain='steam'|'playstation'|'xbox'|'experimental-ps5'|'emulation';

export interface GamingArtifactReceipt {
  artifactId:string;
  kind:GamingArtifactKind;
  version:string;
  digest:string;
  sourceRepository:string;
  licenseId:string;
  provenanceVerified:boolean;
  executable:boolean;
  explicitApproval:boolean;
}

export interface GamingArtifactDecision {allowed:boolean;reason:'approved'|'missing-provenance'|'missing-license'|'invalid-digest'|'explicit-approval-required';}

export class GamingSupplyChainGate {
  verify(artifact:GamingArtifactReceipt):GamingArtifactDecision{
    if(!artifact.provenanceVerified||!artifact.sourceRepository.trim())return{allowed:false,reason:'missing-provenance'};
    if(!artifact.licenseId.trim())return{allowed:false,reason:'missing-license'};
    if(!/^sha256:[a-f0-9]{6,}$/i.test(artifact.digest))return{allowed:false,reason:'invalid-digest'};
    if(artifact.executable&&!artifact.explicitApproval)return{allowed:false,reason:'explicit-approval-required'};
    return{allowed:true,reason:'approved'};
  }
}

export class GamingPermissionIsolation {
  private readonly grants=new Map<GamingPermissionDomain,Set<string>>();
  grant(domain:GamingPermissionDomain,capability:string):void{
    const set=this.grants.get(domain)??new Set<string>();
    set.add(capability);this.grants.set(domain,set);
  }
  has(domain:GamingPermissionDomain,capability:string):boolean{return this.grants.get(domain)?.has(capability)??false;}
  assertNoInheritance(from:GamingPermissionDomain,to:GamingPermissionDomain,capability:string):void{
    if(from!==to&&this.has(from,capability)&&this.has(to,capability))return;
    if(from!==to&&this.has(from,capability)&&!this.has(to,capability))throw new Error(`${from} permission does not authorize ${to}`);
  }
}
