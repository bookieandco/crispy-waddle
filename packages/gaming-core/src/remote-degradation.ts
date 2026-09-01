import type { RemoteQualityMonitorSnapshot } from './remote-quality-monitor.js';

export type DegradationAction = 'none' | 'reduce-video' | 'protect-input' | 'safe-stop';
export interface DegradationDecision { action: DegradationAction; reason: string; }
export interface DegradationPolicy { safeStopAfterBlockedSamples?: number; }

export class RemoteDegradationController {
  private consecutiveBlocked = 0;
  constructor(private readonly policy: DegradationPolicy = {}) {}
  evaluate(snapshot: RemoteQualityMonitorSnapshot): DegradationDecision {
    if (snapshot.state === 'healthy') { this.consecutiveBlocked = 0; return { action: 'none', reason: 'connection healthy' }; }
    if (snapshot.state === 'degraded') { this.consecutiveBlocked = 0; return { action: 'reduce-video', reason: 'preserve input responsiveness by reducing video demand' }; }
    this.consecutiveBlocked += 1;
    const limit = this.policy.safeStopAfterBlockedSamples ?? 3;
    if (this.consecutiveBlocked >= limit) return { action: 'safe-stop', reason: 'connection remained outside remote-play policy' };
    return { action: 'protect-input', reason: 'connection is currently outside remote-play policy' };
  }
}
