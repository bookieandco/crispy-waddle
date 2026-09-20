import type { CanonicalGameInput } from './controller.js';
import type { LaunchContext } from './runtime.js';
import type { MoonlightClient, MoonlightHost, MoonlightSession } from './moonlight-runtime.js';
import type { NegotiatedStreamConfig } from './negotiated-stream.js';

export type MoonlightIpcRequest =
 | {id:string;type:'discover'}
 | {id:string;type:'launch';hostId:string;appId:string;context:LaunchContext;stream:NegotiatedStreamConfig}
 | {id:string;type:'input';sessionId:string;input:CanonicalGameInput}
 | {id:string;type:'stream';sessionId:string}
 | {id:string;type:'stop';sessionId:string};

export type MoonlightIpcResponse =
 | {id:string;ok:true;type:'hosts';hosts:readonly MoonlightHost[]}
 | {id:string;ok:true;type:'session';session:MoonlightSession}
 | {id:string;ok:true;type:'stream';stream?:NegotiatedStreamConfig}
 | {id:string;ok:true;type:'ack'}
 | {id:string;ok:false;error:string};

export interface MoonlightProcessTransport { request(request:MoonlightIpcRequest):Promise<MoonlightIpcResponse>; }

export class NativeMoonlightAdapter implements MoonlightClient {
 constructor(private readonly transport:MoonlightProcessTransport){}
 async discoverHosts():Promise<readonly MoonlightHost[]>{const r=await this.transport.request({id:crypto.randomUUID(),type:'discover'});if(!r.ok||r.type!=='hosts')throw new Error(r.ok?'Invalid discovery response':r.error);return r.hosts;}
 async launch(hostId:string,appId:string,input:LaunchContext,stream?:NegotiatedStreamConfig):Promise<MoonlightSession>{if(!stream)throw new Error('Native Moonlight launch requires negotiated stream configuration');const r=await this.transport.request({id:crypto.randomUUID(),type:'launch',hostId,appId,context:input,stream});if(!r.ok||r.type!=='session')throw new Error(r.ok?'Invalid launch response':r.error);return r.session;}
 async getSessionStream(sessionId:string):Promise<NegotiatedStreamConfig|undefined>{const r=await this.transport.request({id:crypto.randomUUID(),type:'stream',sessionId});if(!r.ok||r.type!=='stream')throw new Error(r.ok?'Invalid stream response':r.error);return r.stream;}
 async sendInput(sessionId:string,input:CanonicalGameInput):Promise<void>{const r=await this.transport.request({id:crypto.randomUUID(),type:'input',sessionId,input});if(!r.ok||r.type!=='ack')throw new Error(r.ok?'Invalid input response':r.error);}
 async stop(sessionId:string):Promise<void>{const r=await this.transport.request({id:crypto.randomUUID(),type:'stop',sessionId});if(!r.ok||r.type!=='ack')throw new Error(r.ok?'Invalid stop response':r.error);}
}
