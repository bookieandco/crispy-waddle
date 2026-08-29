import type { MicWarmMode, MicWarmPort } from "./mic-warm-port";

export interface MicWarmPolicy {
  mode: MicWarmMode;
}

export class MicWarmCoordinator {
  constructor(
    private readonly warm: MicWarmPort,
    private readonly policy: MicWarmPolicy,
  ) {}

  async prepareForVoiceCapture(): Promise<void> {
    if (this.policy.mode === "disabled") return;
    await this.warm.start(this.policy.mode);
  }

  async releaseAfterVoiceCapture(): Promise<void> {
    if (this.policy.mode === "always") return;
    await this.warm.stop();
  }
}
