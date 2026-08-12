export type MediaStyle = "cartoon" | "realistic" | "hybrid";
export type RigMode = "2d-cutout" | "2d-puppet" | "3d-skeletal" | "facial" | "custom";
export type ImmersionLayer = "character" | "environment" | "camera" | "lighting" | "particles" | "sound" | "depth" | "color";

export interface RigDefinition {
  id: string;
  name: string;
  mode: RigMode;
  joints: string[];
  controls: string[];
  deformationProfile?: string;
}

export interface ImmersiveScene {
  id: string;
  style: MediaStyle;
  rigIds: string[];
  layers: ImmersionLayer[];
  tracking: "none" | "2d" | "3d" | "camera-aware";
  depthAware: boolean;
  audioReactive: boolean;
  status: "draft" | "tracking" | "animating" | "compositing" | "review" | "approved";
}

export interface AnimationJob {
  id: string;
  sceneId: string;
  operation: "rig" | "track" | "animate" | "replace" | "composite" | "stylize" | "render";
  status: "proposed" | "awaiting-approval" | "running" | "complete" | "failed";
  requiresApproval: boolean;
}

export const IMMERSION_LAYERS: ImmersionLayer[] = [
  "character", "environment", "camera", "lighting", "particles", "sound", "depth", "color",
];

export function createImmersiveScene(style: MediaStyle = "hybrid"): ImmersiveScene {
  return {
    id: crypto.randomUUID(), style, rigIds: [], layers: IMMERSION_LAYERS, tracking: "camera-aware",
    depthAware: true, audioReactive: true, status: "draft",
  };
}

export function createAnimationJob(input: Omit<AnimationJob, "id" | "status">): AnimationJob {
  return { ...input, id: crypto.randomUUID(), status: input.requiresApproval ? "awaiting-approval" : "proposed" };
}
