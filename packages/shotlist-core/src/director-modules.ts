export type DirectorModuleKind = "voice" | "inpainting" | "camera" | "lighting" | "sound" | "spatial" | "performance" | "design" | "wardrobe" | "drone";

export interface DirectorModuleRef {
  id: string;
  kind: DirectorModuleKind;
  provider: string;
  capabilities: string[];
  license?: string;
  commercialUse?: boolean;
  status: "research" | "adapter-ready" | "integrated";
}

/** Provider-neutral capabilities surfaced by the Director; implementations live outside shotlist-core. */
export interface DirectorCapabilityRegistry {
  modules: DirectorModuleRef[];
  find(kind: DirectorModuleKind): DirectorModuleRef[];
}

export const directorCapabilityRegistry = (modules: DirectorModuleRef[]): DirectorCapabilityRegistry => ({
  modules,
  find: (kind) => modules.filter((module) => module.kind === kind),
});

export interface VoiceDirection {
  speakerId?: string;
  language?: string;
  emotion?: string;
  pace?: number;
  pauseTokens?: string[];
  dialogue?: string;
}

export interface CameraDirection {
  focalLengthMm?: number;
  aperture?: number;
  movement?: string;
  stabilization?: string;
  target?: string;
  fixed?: boolean;
}

export interface LightingDirection {
  key?: string;
  fill?: string;
  rim?: string;
  practicals?: string[];
  colorTemperatureK?: number;
  mood?: string;
}

export interface SpatialDirection {
  latitude?: number;
  longitude?: number;
  elevationM?: number;
  headingDeg?: number;
  pitchDeg?: number;
  rollDeg?: number;
  terrain?: boolean;
}

export interface PerformanceDirection {
  poseReferenceUri?: string;
  faceTracking?: boolean;
  bodyTracking?: boolean;
  intensity?: string;
}

export interface WardrobeDirection {
  garmentCategory?: string;
  referenceUri?: string;
  fit?: string;
  color?: string;
  material?: string;
}
