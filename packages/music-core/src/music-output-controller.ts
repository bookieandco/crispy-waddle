import type { AudioOutputDevice } from "./audio-output.js";

export type MusicOutputState = {
  devices: AudioOutputDevice[];
  activeDeviceId: string | null;
  discovering: boolean;
};

export function createMusicOutputState(): MusicOutputState {
  return { devices: [], activeDeviceId: null, discovering: false };
}

export function setOutputDevices(state: MusicOutputState, devices: AudioOutputDevice[]): MusicOutputState {
  const active = devices.find((device) => device.active) ?? devices.find((device) => device.id === state.activeDeviceId);
  return { devices, activeDeviceId: active?.id ?? null, discovering: false };
}

export function beginOutputDiscovery(state: MusicOutputState): MusicOutputState {
  return { ...state, discovering: true };
}

export function selectOutput(state: MusicOutputState, deviceId: string): MusicOutputState {
  if (!state.devices.some((device) => device.id === deviceId)) return state;
  return {
    ...state,
    activeDeviceId: deviceId,
    devices: state.devices.map((device) => ({ ...device, active: device.id === deviceId })),
  };
}

export function activeOutput(state: MusicOutputState): AudioOutputDevice | null {
  return state.devices.find((device) => device.id === state.activeDeviceId) ?? null;
}
