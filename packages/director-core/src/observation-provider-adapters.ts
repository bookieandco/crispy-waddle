import type { Observation } from './observation-bus.js';
import type { DecodedAudio, DecodedFrame } from './media-decoder-adapter.js';

export type ObservationProvider = {
  name: string;
  observeFrame?(frame: DecodedFrame): Promise<Observation[]>;
  observeAudio?(audio: DecodedAudio): Promise<Observation[]>;
};

export function createObservationProviderRegistry(providers: ObservationProvider[]) {
  return {
    async observeFrame(frame: DecodedFrame): Promise<Observation[]> {
      return (await Promise.all(providers.filter(p => p.observeFrame).map(p => p.observeFrame!(frame)))).flat();
    },
    async observeAudio(audio: DecodedAudio): Promise<Observation[]> {
      return (await Promise.all(providers.filter(p => p.observeAudio).map(p => p.observeAudio!(audio)))).flat();
    },
  };
}
