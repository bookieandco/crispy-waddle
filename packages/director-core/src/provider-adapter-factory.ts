import type { ObservationProvider } from './observation-provider-adapters';
import type { DecodedAudio, DecodedFrame } from './media-decoder-adapter';

export type ProviderAdapterConfig = {
  name: string;
  frame?: (frame: DecodedFrame) => Promise<import('./observation-bus').Observation[]>;
  audio?: (audio: DecodedAudio) => Promise<import('./observation-bus').Observation[]>;
};

export function createProviderAdapter(config: ProviderAdapterConfig): ObservationProvider {
  return {
    name: config.name,
    observeFrame: config.frame,
    observeAudio: config.audio,
  };
}

export function createMultimodalProviderSet(configs: ProviderAdapterConfig[]): ObservationProvider[] {
  return configs.map(createProviderAdapter);
}
