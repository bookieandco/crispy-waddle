import type { MoonlightHost } from './moonlight-runtime.js';

export interface SunshineDiscoveryPacket { address:string; port?:number; name?:string; id?:string; [key:string]:unknown; }
export interface SunshineDiscoveryTransport { discover(timeoutMs:number):Promise<readonly SunshineDiscoveryPacket[]>; }
export interface SunshineHostDiscoveryOptions { timeoutMs?:number; }

export class SunshineHostDiscovery {
  constructor(private readonly transport:SunshineDiscoveryTransport, private readonly options:SunshineHostDiscoveryOptions={}) {}
  async discover():Promise<readonly MoonlightHost[]> {
    const packets=await this.transport.discover(this.options.timeoutMs??1500);
    const seen=new Set<string>();
    return packets.filter(p=>p.address?.trim()).map((p)=>{const address=p.address.trim();const port=p.port??47989;if(!Number.isInteger(port)||port<1||port>65535) return undefined;const id=p.id?.trim()||`sunshine:${address}:${port}`;return {id,name:p.name?.trim()||'Sunshine Host',address,paired:false,port} as MoonlightHost & {port:number};}).filter((h):h is MoonlightHost & {port:number}=>Boolean(h)).filter(h=>{if(seen.has(h.id))return false;seen.add(h.id);return true;});
  }
}
