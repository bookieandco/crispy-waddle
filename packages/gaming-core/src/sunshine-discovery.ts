import type { MoonlightHost } from './moonlight-runtime.js';

export interface SunshineDiscoveryPacket { address:string; port?:number; name?:string; id?:string; [key:string]:unknown; }
export interface SunshineDiscoveryTransport { discover(timeoutMs:number):Promise<readonly SunshineDiscoveryPacket[]>; }
export interface SunshineHostDiscoveryOptions { timeoutMs?:number; }

export class SunshineHostDiscovery {
  constructor(private readonly transport:SunshineDiscoveryTransport, private readonly options:SunshineHostDiscoveryOptions={}) {}
  async discover():Promise<readonly MoonlightHost[]> {
    const packets=await this.transport.discover(this.options.timeoutMs??1500);
    const seen=new Set<string>();
    return packets.filter(p=>p.address).map((p)=>{const id=p.id?.trim()||`sunshine:${p.address}:${p.port??47989}`;return {id,name:p.name?.trim()||'Sunshine Host',address:p.address,paired:false,port:p.port??47989} as MoonlightHost & {port:number};}).filter(h=>{if(seen.has(h.id))return false;seen.add(h.id);return true;});
  }
}
