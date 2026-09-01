export interface InputEvent {
  inputId: string;
  deviceId: string;
  sequenceNumber: number;
  timestampMs: number;
  control: string;
  value: number | boolean;
}

export interface InputIntegrityResult {
  accepted: boolean;
  reason?: 'duplicate' | 'out-of-order' | 'stale';
}

export interface InputLatencySample {
  inputId: string;
  capturedAtMs: number;
  deliveredAtMs?: number;
  processedAtMs?: number;
  presentedAtMs?: number;
}

export class InputSynchronizationEngine {
  private readonly lastSequence = new Map<string, number>();

  constructor(private readonly staleAfterMs = 100) {}

  accept(event: InputEvent, nowMs = Date.now()): InputIntegrityResult {
    const last = this.lastSequence.get(event.deviceId);
    if (nowMs - event.timestampMs > this.staleAfterMs) return { accepted: false, reason: 'stale' };
    if (last !== undefined && event.sequenceNumber === last) return { accepted: false, reason: 'duplicate' };
    if (last !== undefined && event.sequenceNumber < last) return { accepted: false, reason: 'out-of-order' };
    this.lastSequence.set(event.deviceId, event.sequenceNumber);
    return { accepted: true };
  }

  endToEndMs(sample: InputLatencySample): number | undefined {
    if (sample.presentedAtMs === undefined) return undefined;
    return sample.presentedAtMs - sample.capturedAtMs;
  }
}
