import type { TVDevice } from './types'

/** Deterministic development fixtures; no network discovery is performed. */
export const mockTVDevices: TVDevice[] = [
  {
    id: 'demo-living-room',
    name: 'Living Room TV',
    kind: 'tv',
    protocol: 'google-cast',
    connected: false,
    capabilities: {
      canPlayVideo: true,
      canPause: true,
      canSeek: true,
      canSetVolume: true,
      canPower: false,
    },
  },
  {
    id: 'demo-bedroom',
    name: 'Bedroom TV',
    kind: 'tv',
    protocol: 'bluetooth',
    connected: false,
    capabilities: {
      canPlayVideo: false,
      canPause: false,
      canSeek: false,
      canSetVolume: true,
      canPower: false,
    },
  },
]
