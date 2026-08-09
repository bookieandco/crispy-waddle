export type AudioOutputKind = "device" | "bluetooth" | "airplay" | "car";

export interface AudioOutputDevice {
  id: string;
  name: string;
  kind: AudioOutputKind;
  connected: boolean;
  active: boolean;
}

/**
 * Platform bridge for audio routing. iOS owns Bluetooth/AirPlay pairing and
 * permissions; Music Core only consumes the resulting route state.
 */
export interface AudioOutputBridge {
  listOutputs(): Promise<AudioOutputDevice[]>;
  selectOutput(id: string): Promise<AudioOutputDevice>;
  getActiveOutput(): Promise<AudioOutputDevice | null>;
}

export class MusicAudioOutput {
  constructor(private readonly bridge: AudioOutputBridge) {}

  async devices(): Promise<AudioOutputDevice[]> {
    return this.bridge.listOutputs();
  }

  async select(id: string): Promise<AudioOutputDevice> {
    return this.bridge.selectOutput(id);
  }

  async active(): Promise<AudioOutputDevice | null> {
    return this.bridge.getActiveOutput();
  }
}
