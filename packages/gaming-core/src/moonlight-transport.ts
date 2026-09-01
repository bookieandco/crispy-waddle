import type { CanonicalGameInput } from './controller.js';
import type { LaunchContext } from './runtime.js';
import type { MoonlightClient, MoonlightHost, MoonlightSession, MoonlightStreamCapabilities } from './moonlight-runtime.js';

export interface MoonlightTransport {
  discoverHosts(): Promise<readonly MoonlightHost[]>;
  getHostCapabilities(hostId:string): Promise<MoonlightStreamCapabilities>;
  pair(hostId:string,pin:string): Promise<void>;
  listApps(hostId:string): Promise<readonly {id:string;name:string;kind?:string;launchTarget?:string}[]>;
  launch(hostId:string,appId:string,input:LaunchContext):Promise<MoonlightSession>;
  sendInput(sessionId:string,input:CanonicalGameInput):Promise<void>;
  stop(sessionId:string):Promise<void>;
}

export class MoonlightClientAdapter implements MoonlightClient {
  constructor(private readonly transport:MoonlightTransport){}
  discoverHosts(){return this.transport.discoverHosts();}
  launch(hostId:string,appId:string,input:LaunchContext){return this.transport.launch(hostId,appId,input);}
  sendInput(sessionId:string,input:CanonicalGameInput){return this.transport.sendInput(sessionId,input);}
  stop(sessionId:string){return this.transport.stop(sessionId);}
  getHostCapabilities(hostId:string){return this.transport.getHostCapabilities(hostId);}
  pair(hostId:string,pin:string){return this.transport.pair(hostId,pin);}
  listApps(hostId:string){return this.transport.listApps(hostId);}
}
