import { MediaProviderRegistry } from '../media-providers';
import { createYouTubeProvider } from './youtube';

export interface MediaProviderRuntimeConfig {
  youtubeApiKey?: string;
}

/**
 * Creates the server-side canonical provider registry.
 * Secrets are accepted only at runtime and are never stored by the registry.
 */
export function createMediaProviderRegistry(config: MediaProviderRuntimeConfig = {}): MediaProviderRegistry {
  const registry = new MediaProviderRegistry();

  if (config.youtubeApiKey) {
    registry.register(createYouTubeProvider({ apiKey: config.youtubeApiKey }));
  }

  return registry;
}
