import type { RemoteApp, RemoteAppCatalog } from './remote-apps.js';
import type { SunshinePairingManager } from './sunshine-pairing.js';
import type { MoonlightTransport } from './moonlight-transport.js';

export interface SunshineAppRecord { id:string; name:string; kind?:string; launchTarget?:string; iconUri?:string; metadata?:Readonly<Record<string,string>>; }
export class SunshineAppEnumerator {
 constructor(private readonly transport:MoonlightTransport,private readonly pairing:SunshinePairingManager,private readonly catalog:RemoteAppCatalog){}
 async refresh(hostId:string):Promise<readonly RemoteApp[]>{await this.pairing.requirePaired(hostId);const apps=await this.transport.listApps(hostId);const normalized=apps.map(a=>({id:`${hostId}:${a.id}`,hostId,name:a.name.trim(),kind:(a.kind==='game'||a.kind==='emulator'||a.kind==='desktop'||a.kind==='application'?a.kind:'application') as RemoteApp['kind'],launchTarget:(a.launchTarget??a.id).trim(),iconUri:undefined,metadata:undefined}));for(const app of normalized) this.catalog.upsert(app);return this.catalog.list(hostId);}
}
