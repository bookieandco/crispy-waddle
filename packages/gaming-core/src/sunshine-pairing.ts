export type SunshinePairingState='unpaired'|'pairing'|'paired'|'failed';
export interface SunshinePairingStore{get(hostId:string):Promise<boolean>;set(hostId:string,paired:boolean):Promise<void>;}
export interface SunshinePairingTransport{pair(hostId:string,pin:string):Promise<void>;}
export class SunshinePairingManager{
 constructor(private readonly transport:SunshinePairingTransport,private readonly store:SunshinePairingStore){}
 async state(hostId:string):Promise<SunshinePairingState>{if(!hostId.trim())throw new Error('Sunshine host id is required');return (await this.store.get(hostId))?'paired':'unpaired';}
 async pair(hostId:string,pin:string):Promise<SunshinePairingState>{if(!hostId.trim())throw new Error('Sunshine host id is required');if(!pin.trim())throw new Error('Pairing PIN is required');if(await this.store.get(hostId))return 'paired';try{await this.transport.pair(hostId,pin);await this.store.set(hostId,true);return 'paired';}catch{await this.store.set(hostId,false);return 'failed';}}
 async requirePaired(hostId:string):Promise<void>{if(!hostId.trim())throw new Error('Sunshine host id is required');if(!(await this.store.get(hostId)))throw new Error(`Sunshine host is not paired: ${hostId}`);}
 async unpair(hostId:string):Promise<void>{if(!hostId.trim())throw new Error('Sunshine host id is required');await this.store.set(hostId,false);}
}
