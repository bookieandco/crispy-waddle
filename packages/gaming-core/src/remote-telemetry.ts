export interface RemoteTelemetrySample { atMs:number; rttMs:number; jitterMs:number; packetLossPercent:number; inputLatencyMs:number; encodeLatencyMs?:number; decodeLatencyMs?:number; framePacingMs?:number; }
export interface RemoteTelemetrySource { sample():Promise<RemoteTelemetrySample>; }
export class RemoteTelemetryProbe { constructor(private readonly source:RemoteTelemetrySource){} sample(){return this.source.sample();} }
