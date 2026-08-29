export type MicWarmMode = "disabled" | "on_demand" | "voice_mode" | "always";

export interface MicWarmStatus {
  mode: MicWarmMode;
  ready: boolean;
  deviceName?: string;
}

/** Host-only readiness control. It never captures, stores, or transports audio. */
export interface MicWarmPort {
  getStatus(): Promise<MicWarmStatus>;
  setMode(mode: MicWarmMode): Promise<MicWarmStatus>;
}

export class NoopMicWarmAdapter implements MicWarmPort {
  private mode: MicWarmMode = "disabled";

  async getStatus(): Promise<MicWarmStatus> {
    return { mode: this.mode, ready: false };
  }

  async setMode(mode: MicWarmMode): Promise<MicWarmStatus> {
    this.mode = mode;
    return { mode, ready: false };
  }
}
