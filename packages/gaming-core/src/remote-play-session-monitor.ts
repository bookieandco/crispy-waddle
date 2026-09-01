import type { RemotePlaySession } from './remote-play-session.js';
import { RemoteQualityMonitor, type RemoteQualityMonitorSnapshot } from './remote-quality-monitor.js';
import { RemoteDegradationController, type DegradationDecision } from './remote-degradation.js';

export interface RemoteSessionHealth { sessionId:string; snapshot:RemoteQualityMonitorSnapshot; action:DegradationDecision['action']; reason:string; }

export class RemotePlaySessionMonitor {
  private readonly degradation: RemoteDegradationController;
  private monitor?: RemoteQualityMonitor;
  constructor(private readonly probe:()=>Promise<import('./remote-quality.js').RemoteQualitySample>, private readonly onHealth?:(health:RemoteSessionHealth)=>void, degradationPolicy?:ConstructorParameters<typeof RemoteDegradationController>[0]) { this.degradation=new RemoteDegradationController(degradationPolicy); }
  start(session:RemotePlaySession, policy:import('./remote-quality.js').RemoteQualityPolicy, intervalMs=1000):void {
    this.stop();
    this.monitor=new RemoteQualityMonitor(this.probe,policy,(snapshot)=>{const decision=this.degradation.evaluate(snapshot);this.onHealth?.({sessionId:session.session.id,snapshot,action:decision.action,reason:decision.reason});},{intervalMs});
    this.monitor.start();
  }
  stop():void { this.monitor?.stop(); this.monitor=undefined; }
  sample():Promise<RemoteQualityMonitorSnapshot|undefined> { return this.monitor ? this.monitor.sample() : Promise.resolve(undefined); }
}
