export type StudioDevice = "phone" | "tablet" | "laptop" | "desktop";
export type WorkspaceMode = "quick" | "edit" | "advanced";

export interface StudioDeviceProfile {
  device: StudioDevice;
  touch: boolean;
  keyboard: boolean;
  pointer: boolean;
  preferredWorkspace: WorkspaceMode;
}

export interface StudioWorkspaceState {
  projectId: string;
  activeDevice: StudioDevice;
  mode: WorkspaceMode;
  currentFrame: number;
  selectedTrackId?: string;
  selectedMarkerId?: string;
  pendingActions: string[];
  lastSavedAt?: string;
  syncRevision: number;
}

export const DEVICE_PROFILES: Record<StudioDevice, StudioDeviceProfile> = {
  phone: { device: "phone", touch: true, keyboard: false, pointer: false, preferredWorkspace: "quick" },
  tablet: { device: "tablet", touch: true, keyboard: true, pointer: false, preferredWorkspace: "edit" },
  laptop: { device: "laptop", touch: true, keyboard: true, pointer: true, preferredWorkspace: "edit" },
  desktop: { device: "desktop", touch: false, keyboard: true, pointer: true, preferredWorkspace: "advanced" },
};

export function switchStudioDevice(state: StudioWorkspaceState, device: StudioDevice): StudioWorkspaceState {
  const profile = DEVICE_PROFILES[device];
  return { ...state, activeDevice: device, mode: profile.preferredWorkspace, syncRevision: state.syncRevision + 1 };
}

export function markWorkspaceSaved(state: StudioWorkspaceState, timestamp = new Date().toISOString()): StudioWorkspaceState {
  return { ...state, lastSavedAt: timestamp, syncRevision: state.syncRevision + 1 };
}
