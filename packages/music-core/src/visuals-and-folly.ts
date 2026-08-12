export type VisualizerMode = 'milkdrop' | 'album-art-reactive' | 'waveform' | 'spectrum' | 'custom';

export type FoleyEvent = {
  id: string;
  projectId: string;
  sceneId?: string;
  timestampMs: number;
  durationMs?: number;
  label: string;
  category: 'footsteps' | 'cloth' | 'prop' | 'door' | 'impact' | 'vehicle' | 'environment' | 'body' | 'custom';
  sourceAssetId?: string;
  recorded?: boolean;
  generated?: boolean;
  notes?: string;
};

export type SoundDesignTrack = {
  id: string;
  name: string;
  role: 'dialogue' | 'foley' | 'sfx' | 'ambience' | 'music' | 'room-tone' | 'voiceover';
  events: FoleyEvent[];
};

export type MusicVisualProfile = {
  id: string;
  name: string;
  mode: VisualizerMode;
  beatReactive: boolean;
  fftReactive: boolean;
  presetId?: string;
  palette?: string[];
  transitionStyle?: string;
};

/**
 * MusicOS visualizer adapter. MilkDrop3 is treated as an optional external
 * renderer; MusicOS owns the project state and can swap renderers later.
 */
export function createMusicVisualProfile(name: string, presetId?: string): MusicVisualProfile {
  return {
    id: crypto.randomUUID(),
    name,
    mode: 'milkdrop',
    beatReactive: true,
    fftReactive: true,
    presetId,
  };
}

export function createFoleyTrack(): SoundDesignTrack {
  return {
    id: crypto.randomUUID(),
    name: 'Foley',
    role: 'foley',
    events: [],
  };
}

export function addFoleyEvent(track: SoundDesignTrack, event: Omit<FoleyEvent, 'id'>): SoundDesignTrack {
  return {
    ...track,
    events: [...track.events, { ...event, id: crypto.randomUUID() }].sort((a, b) => a.timestampMs - b.timestampMs),
  };
}
